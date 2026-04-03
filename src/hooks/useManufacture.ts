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
	startGCode,
	pollGCode,
	getPlacementResult,
	getRoutingResult,
	getBitmap,
	getScadResult
} from '@/lib/api'
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

const ALL_STEPS: ManufactureStep[] = ['placement', 'routing', 'bitmap', 'scad', 'compile', 'gcode']

type PipelineSnapshot = Record<string, { status: string; message?: string; detail?: Record<string, unknown> }>

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

function sseUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/sessions/${encodeURIComponent(sessionId)}/manufacture/pipeline/events`
}

function waitForStepSSE (
	sessionId: string,
	step: ManufactureStep,
	cancelRef: React.RefObject<boolean>,
	abortController: AbortController,
	onProgress?: (entry: { status: string; message?: string; detail?: Record<string, unknown> }) => void
): Promise<{ status: string; message?: string; detail?: Record<string, unknown> }> {
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(new CancelError())
		if (cancelRef.current) { reject(new CancelError()); return }
		abortController.signal.addEventListener('abort', onAbort, { once: true })

		const run = async () => {
			try {
				const response = await fetch(sseUrl(sessionId), { signal: abortController.signal })
				if (!response.ok) {
					throw new StepError(`SSE connect failed (${response.status})`)
				}
				const reader = response.body?.getReader()
				if (!reader) { throw new StepError('No response body') }

				const decoder = new TextDecoder()
				let buffer = ''

				while (true) {
					if (cancelRef.current) { reader.cancel(); reject(new CancelError()); return }
					const { done, value } = await reader.read()
					if (done) { break }

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() ?? ''

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							try {
								const snapshot: PipelineSnapshot = JSON.parse(line.slice(6))
								const entry = snapshot[step]
								if (!entry) { continue }
								if (entry.status === 'done') {
									reader.cancel()
									resolve(entry)
									return
								}
								if (entry.status === 'error') {
									reader.cancel()
									reject(new StepError(entry.message ?? `${step} failed`, entry.detail))
									return
								}
								if (onProgress && entry.status === 'running') {
									onProgress(entry)
								}
							} catch { /* ignore parse errors */ }
						}
					}
				}
				reject(new StepError(`SSE stream ended before ${step} completed`))
			} catch (err) {
				if ((err as Error).name === 'AbortError') { reject(new CancelError()); return }
				if (err instanceof CancelError || err instanceof StepError) { reject(err); return }
				reject(new StepError(`SSE error: ${(err as Error).message}`))
			}
		}

		run()
	})
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
	const sseAbortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		setSteps(initSteps(currentSession?.artifacts ?? {}, currentSession?.pipeline_errors))
		setPlacementResult(null)
		setRoutingResult(null)
		setBitmapResult(null)
		setScadResult(null)
		setGcodeStatus(null)
		if (currentSession?.id) {
			const a = currentSession.artifacts ?? {}
			const errors = currentSession.pipeline_errors ?? {}
			const fetches: Promise<void>[] = []
			if (a.placement) {
				fetches.push(getPlacementResult(currentSession.id).then(setPlacementResult).catch(() => {}))
			}
			if (a.routing || errors.routing) {
				fetches.push(getRoutingResult(currentSession.id).then(setRoutingResult).catch(() => {}))
			}
			if (a.routing && !errors.routing) {
				fetches.push(getBitmap(currentSession.id).then(setBitmapResult).catch(() => {}))
			}
			if (a.scad) {
				fetches.push(getScadResult(currentSession.id).then(setScadResult).catch(() => {}))
			}
			Promise.all(fetches)

			checkForRunningSteps(currentSession.id)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentSession?.id])

	const checkForRunningSteps = useCallback((sessionId: string) => {
		const controller = new AbortController()
		const run = async () => {
			try {
				const response = await fetch(sseUrl(sessionId), { signal: controller.signal })
				if (!response.ok) { return }
				const reader = response.body?.getReader()
				if (!reader) { return }

				const decoder = new TextDecoder()
				let buffer = ''
				let gotRunning = false

				while (true) {
					const { done, value } = await reader.read()
					if (done) { break }

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() ?? ''

					for (const line of lines) {
						if (!line.startsWith('data: ')) { continue }
						try {
							const snapshot: PipelineSnapshot = JSON.parse(line.slice(6))
							const hasRunning = ALL_STEPS.some(s => {
								const entry = snapshot[s]
								return entry && (entry.status === 'running' || entry.status === 'compiling')
							})

							if (hasRunning && !gotRunning) {
								gotRunning = true
								setRunning(true)
								setSteps(prev => prev.map(s => {
									const entry = snapshot[s.step]
									if (!entry) { return s }
									const status = entry.status === 'compiling' ? 'running' : entry.status as StepStatus
									return {
										...s,
										status,
										message: entry.message || undefined,
										responsibleAgent: entry.detail?.responsible_agent as 'design' | 'circuit' | undefined
									}
								}))
							}

							if (gotRunning) {
								setSteps(prev => prev.map(s => {
									const entry = snapshot[s.step]
									if (!entry) { return s }
									const status = entry.status === 'compiling' ? 'running' : entry.status as StepStatus
									return {
										...s,
										status,
										message: entry.message || undefined,
										responsibleAgent: entry.detail?.responsible_agent as 'design' | 'circuit' | undefined
									}
								}))

								const nowRunning = ALL_STEPS.some(s => {
									const entry = snapshot[s]
									return entry && (entry.status === 'running' || entry.status === 'compiling')
								})
								const firstRunning = ALL_STEPS.find(s => {
									const entry = snapshot[s]
									return entry && (entry.status === 'running' || entry.status === 'compiling')
								})
								setCurrentStep(firstRunning ?? null)

								if (!nowRunning) {
									setRunning(false)
									setCurrentStep(null)
									reader.cancel()
									refreshSession().catch(() => {})
									const finalSnapshot = snapshot
									if (finalSnapshot.placement?.status === 'done') {
										getPlacementResult(sessionId).then(setPlacementResult).catch(() => {})
									}
									if (finalSnapshot.routing?.status === 'done') {
										getRoutingResult(sessionId).then(setRoutingResult).catch(() => {})
									}
									if (finalSnapshot.bitmap?.status === 'done') {
										getBitmap(sessionId).then(setBitmapResult).catch(() => {})
									}
									if (finalSnapshot.scad?.status === 'done') {
										getScadResult(sessionId).then(setScadResult).catch(() => {})
									}
									if (finalSnapshot.gcode?.status === 'done') {
										pollGCode(sessionId).then(setGcodeStatus).catch(() => {})
									}
									return
								}
							}

							if (!hasRunning && !gotRunning) {
								reader.cancel()
								return
							}
						} catch { /* ignore parse errors */ }
					}
				}
			} catch { /* SSE check failed, not critical */ }
		}
		run()
		return () => { controller.abort() }
	}, [refreshSession])

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
		sseAbortRef.current?.abort()
	}, [])

	const runPipeline = useCallback(async (fromStep?: ManufactureStep, options?: { filament?: string; silverink_only?: boolean; two_part?: boolean; toStep?: ManufactureStep }) => {
		if (!currentSession || running) { return }

		cancelRef.current = false
		sseAbortRef.current?.abort()
		const sseAbort = new AbortController()
		sseAbortRef.current = sseAbort
		setRunning(true)

		const sessionId = currentSession.id
		const startIdx = fromStep ? ALL_STEPS.indexOf(fromStep) : 0
		const endIdx = options?.toStep ? ALL_STEPS.indexOf(options.toStep) : ALL_STEPS.length - 1
		let activeStep: ManufactureStep | null = null

		setSteps(prev => prev.map((s, i) => {
			if (i < startIdx || i > endIdx) { return s }
			if (s.status === 'error') { return { ...s, status: 'pending' as StepStatus, message: undefined, responsibleAgent: undefined } }
			return { ...s, status: 'pending', message: undefined, responsibleAgent: undefined }
		}))

		const shouldRun = (step: ManufactureStep): boolean => {
			const idx = ALL_STEPS.indexOf(step)
			if (idx < startIdx || idx > endIdx) { return false }
			return true
		}

		try {
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('placement')) {
				activeStep = 'placement'
				setCurrentStep('placement')
				updateStep('placement', { status: 'running' })
				await runPlacement(sessionId)
				await waitForStepSSE(sessionId, 'placement', cancelRef, sseAbort)
				const pr = await getPlacementResult(sessionId)
				setPlacementResult(pr)
				updateStep('placement', { status: 'done' })
			} else {
				updateStep('placement', { status: 'done', message: 'Using existing' })
			}

			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('routing')) {
				activeStep = 'routing'
				setCurrentStep('routing')
				updateStep('routing', { status: 'running' })
				await runRouting(sessionId)
				let fetchInFlight = false
				await waitForStepSSE(sessionId, 'routing', cancelRef, sseAbort, (entry) => {
					const d = entry.detail
					const routingDetail: RoutingProgressDetail | undefined = d ? {
						iteration: d.iteration as number ?? 0,
						maxIterations: d.max_iterations as number ?? 0,
						phase: d.phase as string ?? '',
						routed: d.routed as number ?? 0,
						totalNets: d.total_nets as number ?? 0,
						failedNets: (d.failed_nets as string[]) ?? [],
						totalLengthMm: d.total_length_mm as number ?? 0,
						traceLengths: (d.trace_lengths as Record<string, number>) ?? {},
						stall: d.stall as number ?? 0,
						stallLimit: d.stall_limit as number ?? 0,
					} : undefined
					updateStep('routing', { status: 'running', message: entry.message, routingDetail })
					if (!fetchInFlight) {
						fetchInFlight = true
						getRoutingResult(sessionId)
							.then(setRoutingResult)
							.catch(() => {})
							.finally(() => { fetchInFlight = false })
					}
				})
				const rr = await getRoutingResult(sessionId)
				setRoutingResult(rr)
				updateStep('routing', { status: 'done' })
			} else {
				updateStep('routing', { status: 'done', message: 'Using existing' })
			}

			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('bitmap')) {
				activeStep = 'bitmap'
				setCurrentStep('bitmap')
				updateStep('bitmap', { status: 'running' })
				await generateBitmap(sessionId)
				await waitForStepSSE(sessionId, 'bitmap', cancelRef, sseAbort)
				const br = await getBitmap(sessionId)
				setBitmapResult(br)
				updateStep('bitmap', { status: 'done' })
			} else {
				updateStep('bitmap', { status: 'done', message: 'Using existing' })
			}

			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('scad')) {
				activeStep = 'scad'
				setCurrentStep('scad')
				updateStep('scad', { status: 'running' })
				await generateScad(sessionId, { two_part: options?.two_part })
				await waitForStepSSE(sessionId, 'scad', cancelRef, sseAbort)
				const sr = await getScadResult(sessionId)
				setScadResult(sr)
				updateStep('scad', { status: 'done' })
			} else {
				updateStep('scad', { status: 'done', message: 'Using existing' })
			}

			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('compile')) {
				activeStep = 'compile'
				setCurrentStep('compile')
				updateStep('compile', { status: 'running' })
				await startCompile(sessionId, true)
				await waitForStepSSE(sessionId, 'compile', cancelRef, sseAbort)
				updateStep('compile', { status: 'done' })
			} else {
				updateStep('compile', { status: 'done', message: 'Using existing' })
			}

			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('gcode')) {
				activeStep = 'gcode'
				setCurrentStep('gcode')
				updateStep('gcode', { status: 'running' })
				await startGCode(sessionId, {
					force: true,
					silverink_only: options?.silverink_only
				})
				await waitForStepSSE(sessionId, 'gcode', cancelRef, sseAbort)
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
					const failedIdx = ALL_STEPS.indexOf(activeStep)
					setSteps(prev => prev.map((s, i) =>
						i > failedIdx && s.status === 'done'
							? { ...s, status: 'pending' as StepStatus, message: undefined, responsibleAgent: undefined }
							: s
					))
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
			refreshSession().catch(() => {})
		}
	}, [currentSession, running, updateStep, refreshSession, addError])

	useEffect(() => {
		return () => {
			cancelRef.current = true
			sseAbortRef.current?.abort()
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
