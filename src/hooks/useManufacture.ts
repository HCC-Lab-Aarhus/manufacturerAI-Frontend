'use client'

import { type AxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { useSession } from '@/contexts/SessionContext'
import {
	runPlacement,
	runRouting,
	generateBitmap,
	generateScad,
	startCompile,
	pollCompile,
	startGCode,
	pollGCode,
	getPlacementResult,
	getRoutingResult,
	getBitmap,
	getScadResult
} from '@/lib/api'
import { pollBitmap } from '@/lib/api/pipeline/bitmap'
import { pollPlacement } from '@/lib/api/pipeline/placement'
import { pollRouting } from '@/lib/api/pipeline/routing'
import { pollScad } from '@/lib/api/pipeline/scad'
import type { ManufactureStep, PlacementResult, RoutingResult, BitmapResult, ScadResult, GCodeStatus, PipelineError } from '@/types/models'

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface ManufactureStepState {
	step: ManufactureStep
	label: string
	status: StepStatus
	message?: string
	responsibleAgent?: 'design' | 'circuit'
}

const STEP_DEFS: { step: ManufactureStep; label: string; artifact: string }[] = [
	{ step: 'placement', label: 'Component Placement', artifact: 'placement' },
	{ step: 'routing', label: 'Trace Routing', artifact: 'routing' },
	{ step: 'bitmap', label: 'Trace Bitmap', artifact: 'bitmap' },
	{ step: 'scad', label: 'Enclosure Generation', artifact: 'scad' },
	{ step: 'compile', label: 'STL Compilation', artifact: '' },
	{ step: 'gcode', label: 'G-Code Pipeline', artifact: 'gcode' }
]

type PollFn = (sessionId: string) => Promise<{ status: string; message?: string; detail?: Record<string, unknown> }>

const POLL_MAP: Record<ManufactureStep, PollFn> = {
	placement: pollPlacement,
	routing: pollRouting,
	bitmap: pollBitmap as PollFn,
	scad: pollScad,
	compile: pollCompile as PollFn,
	gcode: pollGCode as PollFn
}

function initSteps (artifacts: Record<string, boolean>, errors?: Record<string, PipelineError>): ManufactureStepState[] {
	let upstreamFailed = false
	return STEP_DEFS.map(({ step, label }) => {
		const err = errors?.[step]
		if (err) {
			upstreamFailed = true
			return { step, label, status: 'error' as StepStatus, message: err.reason, responsibleAgent: err.responsible_agent }
		}
		if (upstreamFailed) {
			return { step, label, status: 'pending' as StepStatus }
		}
		const done = !!artifacts[step]
		return { step, label, status: done ? 'done' as StepStatus : 'pending' as StepStatus }
	})
}

async function waitForStep (
	sessionId: string,
	step: ManufactureStep,
	cancelRef: React.RefObject<boolean>,
	interval: number = 2000
): Promise<{ status: string; message?: string; detail?: Record<string, unknown> }> {
	const poll = POLL_MAP[step]
	if (!poll) {
		return { status: 'done' }
	}

	for (;;) {
		if (cancelRef.current) {
			throw new CancelError()
		}
		const s = await poll(sessionId)
		if (s.status === 'done') {
			return s
		}
		if (s.status === 'error') {
			throw new StepError(s.message ?? `${step} failed`, s.detail)
		}
		await new Promise(resolve => setTimeout(resolve, interval))
	}
}

export function useManufacture () {
	const { currentSession, refreshSession, pendingInvalidation, clearInvalidation } = useSession()
	const { addError } = useError()

	const [steps, setSteps] = useState<ManufactureStepState[]>(() =>
		initSteps(currentSession?.artifacts ?? {}, currentSession?.pipeline_errors)
	)
	const [running, setRunning] = useState(false)
	const [currentStep, setCurrentStep] = useState<ManufactureStep | null>(null)
	const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null)
	const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null)
	const [bitmapResult, setBitmapResult] = useState<BitmapResult | null>(null)
	const [scadResult, setScadResult] = useState<ScadResult | null>(null)
	const [gcodeStatus, setGcodeStatus] = useState<GCodeStatus | null>(null)
	const cancelRef = useRef(false)

	useEffect(() => {
		setSteps(initSteps(currentSession?.artifacts ?? {}, currentSession?.pipeline_errors))
		if (currentSession?.id) {
			const a = currentSession.artifacts ?? {}
			const errors = currentSession.pipeline_errors ?? {}
			if (a.placement) {
				getPlacementResult(currentSession.id).then(setPlacementResult).catch(() => {})
			}
			if (a.routing || errors.routing) {
				getRoutingResult(currentSession.id).then(setRoutingResult).catch(() => {})
			}
			if (a.routing && !errors.routing) {
				getBitmap(currentSession.id).then(setBitmapResult).catch(() => {})
			}
			if (a.scad) {
				getScadResult(currentSession.id).then(setScadResult).catch(() => {})
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentSession?.id])

	useEffect(() => {
		if (!pendingInvalidation?.length) { return }
		setSteps(prev => prev.map(s =>
			pendingInvalidation.includes(s.step)
				? { ...s, status: 'pending' as StepStatus, message: undefined, responsibleAgent: undefined }
				: s
		))
		if (pendingInvalidation.includes('placement')) { setPlacementResult(null) }
		if (pendingInvalidation.includes('routing')) { setRoutingResult(null) }
		if (pendingInvalidation.includes('bitmap')) { setBitmapResult(null) }
		if (pendingInvalidation.includes('scad')) { setScadResult(null) }
		clearInvalidation()
	}, [pendingInvalidation, clearInvalidation])

	const updateStep = useCallback((step: ManufactureStep, update: Partial<ManufactureStepState>) => {
		setSteps(prev => prev.map(s =>
			s.step === step ? { ...s, ...update } : s
		))
	}, [])

	const stop = useCallback(() => {
		cancelRef.current = true
	}, [])

	const runPipeline = useCallback(async (fromStep?: ManufactureStep, options?: { filament?: string; silverink_only?: boolean; toStep?: ManufactureStep }) => {
		if (!currentSession || running) { return }
		if (!options?.filament) { return }

		cancelRef.current = false
		setRunning(true)

		const sessionId = currentSession.id
		const artifacts = currentSession.artifacts
		const allSteps: ManufactureStep[] = ['placement', 'routing', 'bitmap', 'scad', 'compile', 'gcode']
		const startIdx = fromStep ? allSteps.indexOf(fromStep) : 0
		const endIdx = options?.toStep ? allSteps.indexOf(options.toStep) : allSteps.length - 1
		let activeStep: ManufactureStep | null = null

		setSteps(prev => prev.map((s, i) => {
			if (i < startIdx || i > endIdx) { return s }
			if (s.status === 'done' && !fromStep) { return s }
			if (s.status === 'error') { return { ...s, status: 'pending' as StepStatus, message: undefined, responsibleAgent: undefined } }
			return { ...s, status: 'pending', message: undefined, responsibleAgent: undefined }
		}))

		const shouldRun = (step: ManufactureStep): boolean => {
			const idx = allSteps.indexOf(step)
			if (idx < startIdx || idx > endIdx) { return false }
			if (fromStep) { return true }
			// Re-run steps that errored in a previous attempt
			if (currentSession.pipeline_errors?.[step]) { return true }
			return !artifacts[step]
		}

		try {
			// Placement
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('placement')) {
				activeStep = 'placement'
				setCurrentStep('placement')
				updateStep('placement', { status: 'running' })
				await runPlacement(sessionId)
				await waitForStep(sessionId, 'placement', cancelRef)
				const pr = await getPlacementResult(sessionId)
				setPlacementResult(pr)
				updateStep('placement', { status: 'done' })
			} else {
				updateStep('placement', { status: 'done', message: 'Using existing' })
			}

			// Routing
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('routing')) {
				activeStep = 'routing'
				setCurrentStep('routing')
				updateStep('routing', { status: 'running' })
				await runRouting(sessionId)
				await waitForStep(sessionId, 'routing', cancelRef)
				const rr = await getRoutingResult(sessionId)
				setRoutingResult(rr)
				updateStep('routing', { status: 'done' })
			} else {
				updateStep('routing', { status: 'done', message: 'Using existing' })
			}

			// Bitmap
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('bitmap')) {
				activeStep = 'bitmap'
				setCurrentStep('bitmap')
				updateStep('bitmap', { status: 'running' })
				await generateBitmap(sessionId)
				await waitForStep(sessionId, 'bitmap', cancelRef)
				const br = await getBitmap(sessionId)
				setBitmapResult(br)
				updateStep('bitmap', { status: 'done' })
			} else {
				updateStep('bitmap', { status: 'done', message: 'Using existing' })
			}

			// SCAD
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('scad')) {
				activeStep = 'scad'
				setCurrentStep('scad')
				updateStep('scad', { status: 'running' })
				await generateScad(sessionId)
				await waitForStep(sessionId, 'scad', cancelRef)
				const sr = await getScadResult(sessionId)
				setScadResult(sr)
				updateStep('scad', { status: 'done' })
			} else {
				updateStep('scad', { status: 'done', message: 'Using existing' })
			}

			// Compile
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('compile')) {
				activeStep = 'compile'
				setCurrentStep('compile')
				updateStep('compile', { status: 'running' })
				await startCompile(sessionId, true)
				await waitForStep(sessionId, 'compile', cancelRef, 3000)
				updateStep('compile', { status: 'done' })
			} else {
				updateStep('compile', { status: 'done', message: 'Using existing' })
			}

			// G-code
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('gcode')) {
				activeStep = 'gcode'
				setCurrentStep('gcode')
				updateStep('gcode', { status: 'running' })
				await startGCode(sessionId, {
					force: true,
					filament: options!.filament!,
					silverink_only: options?.silverink_only
				})
				await waitForStep(sessionId, 'gcode', cancelRef, 3000)
				const gs = await pollGCode(sessionId)
				setGcodeStatus(gs)
				updateStep('gcode', { status: 'done' })
			} else {
				updateStep('gcode', { status: 'done', message: 'Using existing' })
			}

		} catch (err) {
			if (err instanceof CancelError) {
				if (activeStep) {
					updateStep(activeStep, { status: 'pending', message: 'Cancelled' })
				}
			} else {
				const { message, responsibleAgent } = extractPipelineError(err)
				if (activeStep) {
					updateStep(activeStep, { status: 'error', message, responsibleAgent })
					// Reset all downstream steps to pending so they don't stay
					// green from a previous successful run.
					const failedIdx = allSteps.indexOf(activeStep)
					setSteps(prev => prev.map((s, i) =>
						i > failedIdx && s.status === 'done'
							? { ...s, status: 'pending' as StepStatus, message: undefined, responsibleAgent: undefined }
							: s
					))
					// Fetch partial routing result so the viewport can show what was routed
					if (activeStep === 'routing') {
						getRoutingResult(sessionId).then(setRoutingResult).catch(() => {})
					}
				}
				if (!responsibleAgent) {
					addError(message)
				}
			}
		} finally {
			setRunning(false)
			setCurrentStep(null)
			// Always refresh session so currentSession.artifacts and pipeline_errors
			// are up-to-date for the next pipeline run.
			refreshSession().catch(() => {})
		}
	}, [currentSession, running, updateStep, refreshSession, addError])

	useEffect(() => {
		return () => {
			cancelRef.current = true
		}
	}, [])

	const allDone = steps.every(s => s.status === 'done')

	return {
		steps,
		running,
		currentStep,
		allDone,
		placementResult,
		routingResult,
		bitmapResult,
		scadResult,
		gcodeStatus,
		runPipeline,
		stop
	}
}

class CancelError extends Error {
	constructor () {
		super('Cancelled')
		this.name = 'CancelError'
	}
}

class StepError extends Error {
	detail?: Record<string, unknown>
	constructor (message: string, detail?: Record<string, unknown>) {
		super(message)
		this.name = 'StepError'
		this.detail = detail
	}
}

function extractPipelineError (err: unknown): { message: string; responsibleAgent?: 'design' | 'circuit' } {
	if (err instanceof StepError && err.detail) {
		const reason = (err.detail.reason ?? err.detail.message ?? err.message) as string
		const agent = err.detail.responsible_agent as 'design' | 'circuit' | undefined
		return { message: reason, responsibleAgent: agent }
	}
	const axiosErr = err as AxiosError<Record<string, unknown>>
	const data = axiosErr?.response?.data
	if (data) {
		const detail = typeof data.detail === 'object' && data.detail !== null
			? data.detail as Record<string, unknown>
			: data
		const reason = (detail.reason ?? detail.message) as string | undefined
		const agent = detail.responsible_agent as 'design' | 'circuit' | undefined
		if (reason) {
			return { message: reason, responsibleAgent: agent }
		}
	}
	return { message: err instanceof Error ? err.message : 'Unknown error' }
}
