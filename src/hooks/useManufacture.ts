'use client'

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
	getBitmap
} from '@/lib/api'
import type { ManufactureStep, PlacementResult, RoutingResult, BitmapResult, GCodeStatus } from '@/types/models'

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface ManufactureStepState {
	step: ManufactureStep
	label: string
	status: StepStatus
	message?: string
}

const STEP_DEFS: { step: ManufactureStep; label: string; artifact: string }[] = [
	{ step: 'placement', label: 'Component Placement', artifact: 'placement' },
	{ step: 'routing', label: 'Trace Routing', artifact: 'routing' },
	{ step: 'bitmap', label: 'Trace Bitmap', artifact: '' },
	{ step: 'scad', label: 'Enclosure Generation', artifact: 'scad' },
	{ step: 'compile', label: 'STL Compilation', artifact: '' },
	{ step: 'gcode', label: 'G-Code Pipeline', artifact: 'gcode' }
]

function initSteps (artifacts: Record<string, boolean>): ManufactureStepState[] {
	const placementDone = !!artifacts.placement
	const routingDone = !!artifacts.routing
	const scadDone = !!artifacts.scad
	const gcodeDone = !!artifacts.gcode

	return STEP_DEFS.map(({ step, label }) => {
		let status: StepStatus = 'pending'
		if (step === 'placement' && placementDone) { status = 'done' }
		if (step === 'routing' && routingDone) { status = 'done' }
		if (step === 'bitmap' && routingDone) { status = 'done' }
		if (step === 'scad' && scadDone) { status = 'done' }
		if (step === 'compile' && scadDone) { status = 'done' }
		if (step === 'gcode' && gcodeDone) { status = 'done' }
		return { step, label, status }
	})
}

export function useManufacture () {
	const { currentSession, refreshSession } = useSession()
	const { addError } = useError()

	const [steps, setSteps] = useState<ManufactureStepState[]>(() =>
		initSteps(currentSession?.artifacts ?? {})
	)
	const [running, setRunning] = useState(false)
	const [currentStep, setCurrentStep] = useState<ManufactureStep | null>(null)
	const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null)
	const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null)
	const [bitmapResult, setBitmapResult] = useState<BitmapResult | null>(null)
	const [gcodeStatus, setGcodeStatus] = useState<GCodeStatus | null>(null)
	const cancelRef = useRef(false)
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		if (!running) {
			setSteps(initSteps(currentSession?.artifacts ?? {}))
		}
		if (currentSession?.id) {
			const a = currentSession.artifacts ?? {}
			if (a.placement) getPlacementResult(currentSession.id).then(setPlacementResult).catch(() => {})
			if (a.routing) getRoutingResult(currentSession.id).then(setRoutingResult).catch(() => {})
			if (a.routing) getBitmap(currentSession.id).then(setBitmapResult).catch(() => {})
		}
	}, [currentSession?.id, currentSession?.artifacts, running])

	const updateStep = useCallback((step: ManufactureStep, update: Partial<ManufactureStepState>) => {
		setSteps(prev => prev.map(s =>
			s.step === step ? { ...s, ...update } : s
		))
	}, [])

	const stop = useCallback(() => {
		cancelRef.current = true
		if (pollRef.current) {
			clearInterval(pollRef.current)
			pollRef.current = null
		}
	}, [])

	const runPipeline = useCallback(async (fromStep?: ManufactureStep, options?: { filament?: string; silverink_only?: boolean }) => {
		if (!currentSession || running) { return }

		cancelRef.current = false
		setRunning(true)

		const sessionId = currentSession.id
		const artifacts = currentSession.artifacts
		const allSteps: ManufactureStep[] = ['placement', 'routing', 'bitmap', 'scad', 'compile', 'gcode']
		const startIdx = fromStep ? allSteps.indexOf(fromStep) : 0

		setSteps(prev => prev.map((s, i) => {
			if (i < startIdx) { return s }
			if (i >= startIdx && s.status === 'done' && !fromStep) { return s }
			return { ...s, status: 'pending', message: undefined }
		}))

		const shouldRun = (step: ManufactureStep): boolean => {
			if (fromStep) { return allSteps.indexOf(step) >= startIdx }
			switch (step) {
				case 'placement': return !artifacts.placement
				case 'routing': return !artifacts.routing
				case 'bitmap': return true
				case 'scad': return !artifacts.scad
				case 'compile': return !artifacts.scad
				case 'gcode': return !artifacts.gcode
				default: return true
			}
		}

		try {
			// Placement
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('placement')) {
				setCurrentStep('placement')
				updateStep('placement', { status: 'running' })
				const pr = await runPlacement(sessionId)
				setPlacementResult(pr)
				updateStep('placement', { status: 'done' })
			} else {
				updateStep('placement', { status: 'done', message: 'Using existing' })
			}

			// Routing
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('routing')) {
				setCurrentStep('routing')
				updateStep('routing', { status: 'running' })
				const rr = await runRouting(sessionId)
				setRoutingResult(rr)
				updateStep('routing', { status: 'done' })
			} else {
				updateStep('routing', { status: 'done', message: 'Using existing' })
			}

			// Bitmap
			if (cancelRef.current) { throw new CancelError() }
			setCurrentStep('bitmap')
			updateStep('bitmap', { status: 'running' })
			await generateBitmap(sessionId)
			const br = await getBitmap(sessionId)
			setBitmapResult(br)
			updateStep('bitmap', { status: 'done' })

			// SCAD
			if (cancelRef.current) { throw new CancelError() }
			if (shouldRun('scad')) {
				setCurrentStep('scad')
				updateStep('scad', { status: 'running' })
				await generateScad(sessionId)
				updateStep('scad', { status: 'done' })
			} else {
				updateStep('scad', { status: 'done', message: 'Using existing' })
			}

			// Compile
			if (cancelRef.current) { throw new CancelError() }
			setCurrentStep('compile')
			updateStep('compile', { status: 'running' })
			const compileResult = await startCompile(sessionId, true)
			if (compileResult.status === 'compiling' || compileResult.status === 'pending') {
				await new Promise<void>((resolve, reject) => {
					pollRef.current = setInterval(async () => {
						if (cancelRef.current) {
							if (pollRef.current) { clearInterval(pollRef.current) }
							pollRef.current = null
							reject(new CancelError())
							return
						}
						try {
							const s = await pollCompile(sessionId)
							if (s.status === 'done') {
								if (pollRef.current) { clearInterval(pollRef.current) }
								pollRef.current = null
								resolve()
							} else if (s.status === 'error') {
								if (pollRef.current) { clearInterval(pollRef.current) }
								pollRef.current = null
								reject(new Error(s.message ?? 'STL compilation failed'))
							}
						} catch (err) {
							if (pollRef.current) { clearInterval(pollRef.current) }
							pollRef.current = null
							reject(err)
						}
					}, 3000)
				})
			} else if (compileResult.status === 'error') {
				throw new Error(compileResult.message ?? 'STL compilation failed')
			}
			updateStep('compile', { status: 'done' })

			// G-code
			if (cancelRef.current) { throw new CancelError() }
			setCurrentStep('gcode')
			updateStep('gcode', { status: 'running' })
			await startGCode(sessionId, {
				force: true,
				filament: options?.filament || undefined,
				silverink_only: options?.silverink_only
			})
			await new Promise<void>((resolve, reject) => {
				pollRef.current = setInterval(async () => {
					if (cancelRef.current) {
						if (pollRef.current) { clearInterval(pollRef.current) }
						pollRef.current = null
						reject(new CancelError())
						return
					}
					try {
						const s = await pollGCode(sessionId)
						setGcodeStatus(s)
						if (s.status === 'done') {
							if (pollRef.current) { clearInterval(pollRef.current) }
							pollRef.current = null
							resolve()
						} else if (s.status === 'error') {
							if (pollRef.current) { clearInterval(pollRef.current) }
							pollRef.current = null
							reject(new Error(s.message ?? 'G-code pipeline failed'))
						}
					} catch (err) {
						if (pollRef.current) { clearInterval(pollRef.current) }
						pollRef.current = null
						reject(err)
					}
				}, 3000)
			})
			updateStep('gcode', { status: 'done' })

			await refreshSession()
		} catch (err) {
			if (err instanceof CancelError) {
				if (currentStep) {
					updateStep(currentStep, { status: 'pending', message: 'Cancelled' })
				}
			} else {
				if (currentStep) {
					updateStep(currentStep, {
						status: 'error',
						message: err instanceof Error ? err.message : 'Unknown error'
					})
				}
				addError(err)
			}
		} finally {
			setRunning(false)
			setCurrentStep(null)
			pollRef.current = null
		}
	}, [currentSession, running, updateStep, refreshSession, addError, currentStep])

	useEffect(() => {
		return () => {
			cancelRef.current = true
			if (pollRef.current) { clearInterval(pollRef.current) }
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
