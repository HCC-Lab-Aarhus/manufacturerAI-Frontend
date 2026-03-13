'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import {
	runPlacement,
	getPlacementResult,
	runRouting,
	getRoutingResult,
	generateScad,
	startCompile,
	pollCompile,
	startGCode,
	pollGCode
} from '@/lib/api'

export function usePipelineActions () {
	const { currentSession, refreshSession } = useSession()
	const {
		setPlacement,
		setRouting,
		setCompileStatus,
		setGcodeStatus
	} = usePipeline()
	const { addError } = useError()

	const [runningStage, setRunningStage] = useState<string | null>(null)
	const compileTimer = useRef<ReturnType<typeof setInterval> | null>(null)
	const gcodeTimer = useRef<ReturnType<typeof setInterval> | null>(null)

	const stopPolling = useCallback(() => {
		if (compileTimer.current) {
			clearInterval(compileTimer.current)
			compileTimer.current = null
		}
		if (gcodeTimer.current) {
			clearInterval(gcodeTimer.current)
			gcodeTimer.current = null
		}
	}, [])

	useEffect(() => stopPolling, [stopPolling])

	const execPlacement = useCallback(async () => {
		if (!currentSession) { return }
		setRunningStage('placement')
		try {
			const result = await runPlacement(currentSession.id)
			setPlacement(result)
			await refreshSession()
		} catch (err) {
			addError(err)
		} finally {
			setRunningStage(null)
		}
	}, [currentSession, setPlacement, refreshSession, addError])

	const loadPlacement = useCallback(async (sessionId: string) => {
		try {
			const result = await getPlacementResult(sessionId)
			setPlacement(result)
		} catch {
			setPlacement(null)
		}
	}, [setPlacement])

	const execRouting = useCallback(async () => {
		if (!currentSession) { return }
		setRunningStage('routing')
		try {
			const result = await runRouting(currentSession.id)
			setRouting(result)
			await refreshSession()
		} catch (err) {
			addError(err)
		} finally {
			setRunningStage(null)
		}
	}, [currentSession, setRouting, refreshSession, addError])

	const loadRouting = useCallback(async (sessionId: string) => {
		try {
			const result = await getRoutingResult(sessionId)
			setRouting(result)
		} catch {
			setRouting(null)
		}
	}, [setRouting])

	const execScad = useCallback(async () => {
		if (!currentSession) { return }
		setRunningStage('scad')
		try {
			await generateScad(currentSession.id)
			const status = await startCompile(currentSession.id)
			setCompileStatus(status)

			if (status.status === 'compiling' || status.status === 'pending') {
				compileTimer.current = setInterval(async () => {
					try {
						const s = await pollCompile(currentSession.id)
						setCompileStatus(s)
						if (s.status === 'done' || s.status === 'error') {
							if (compileTimer.current) {
								clearInterval(compileTimer.current)
								compileTimer.current = null
							}
							setRunningStage(null)
							await refreshSession()
						}
					} catch (err) {
						addError(err)
						if (compileTimer.current) {
							clearInterval(compileTimer.current)
							compileTimer.current = null
						}
						setRunningStage(null)
					}
				}, 4000)
			} else {
				setRunningStage(null)
				await refreshSession()
			}
		} catch (err) {
			addError(err)
			setRunningStage(null)
		}
	}, [currentSession, setCompileStatus, refreshSession, addError])

	const execGCode = useCallback(async (filament?: string, silverinkOnly?: boolean) => {
		if (!currentSession) { return }
		setRunningStage('gcode')
		try {
			await startGCode(currentSession.id, { filament, silverink_only: silverinkOnly })

			gcodeTimer.current = setInterval(async () => {
				try {
					const s = await pollGCode(currentSession.id)
					setGcodeStatus(s)
					if (s.status === 'done' || s.status === 'error') {
						if (gcodeTimer.current) {
							clearInterval(gcodeTimer.current)
							gcodeTimer.current = null
						}
						setRunningStage(null)
						await refreshSession()
					}
				} catch (err) {
					addError(err)
					if (gcodeTimer.current) {
						clearInterval(gcodeTimer.current)
						gcodeTimer.current = null
					}
					setRunningStage(null)
				}
			}, 4000)
		} catch (err) {
			addError(err)
			setRunningStage(null)
		}
	}, [currentSession, setGcodeStatus, refreshSession, addError])

	return {
		runningStage,
		execPlacement,
		loadPlacement,
		execRouting,
		loadRouting,
		execScad,
		execGCode,
		stopPolling
	}
}
