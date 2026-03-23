'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { SimConfig } from '@/lib/api/setup'

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
	.replace(/^http/, 'ws')
	.replace(/\/+$/, '')

interface PeripheralState {
	pressed: boolean
	on: boolean
}

type SimStatus = 'disconnected' | 'connecting' | 'connected' | 'booted' | 'stopped' | 'error'

const MAX_SERIAL_LINES = 500

interface UseSimulationResult {
	peripheralState: Record<string, PeripheralState>
	serialLog: string[]
	status: SimStatus
	error: string | null
	press: (instanceId: string) => void
	release: (instanceId: string) => void
	start: () => void
	stop: () => void
	restart: () => void
	clearLog: () => void
}

export function useSimulation (
	sessionId: string | null,
	simConfig: SimConfig | null
): UseSimulationResult {
	const [peripheralState, setPeripheralState] = useState<Record<string, PeripheralState>>({})
	const [serialLog, setSerialLog] = useState<string[]>([])
	const [status, setStatus] = useState<SimStatus>('disconnected')
	const [error, setError] = useState<string | null>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const permanentError = useRef(false)

	// Initialise state from simConfig
	useEffect(() => {
		if (!simConfig) { return }
		const init: Record<string, PeripheralState> = {}
		for (const p of simConfig.peripherals) {
			init[p.instance_id] = { pressed: false, on: false }
		}
		setPeripheralState(init)
	}, [simConfig])

	// Connect / disconnect WebSocket
	useEffect(() => {
		if (!sessionId || !simConfig || !simConfig.elf_path) {
			setStatus('disconnected')
			return
		}

		let cancelled = false
		permanentError.current = false

		function connect () {
			if (cancelled) { return }
			setStatus('connecting')
			setError(null)

			const url = `${WS_BASE}/api/sessions/${encodeURIComponent(sessionId!)}/setup/simulate`
			const ws = new WebSocket(url)
			wsRef.current = ws

			ws.onopen = () => {
				if (cancelled) { ws.close(); return }
				setStatus('connected')
			}

			ws.onmessage = (ev) => {
				let data: Record<string, unknown>
				try { data = JSON.parse(ev.data as string) } catch { return }

				const event = data.event as string | undefined
				if (event === 'boot_ok') {
					setStatus('booted')
				} else if (event === 'pin_change') {
					const iid = data.instance_id as string
					const on = data.on as boolean
					setPeripheralState(prev => {
						if (!(iid in prev)) { return prev }
						return { ...prev, [iid]: { ...prev[iid], on } }
					})
				} else if (event === 'serial') {
					const text = data.data as string
					if (text) {
						setSerialLog(prev => {
							const next = [...prev, text]
							return next.length > MAX_SERIAL_LINES ? next.slice(-MAX_SERIAL_LINES) : next
						})
					}
				} else if (event === 'stopped') {
					setStatus('stopped')
				} else if (event === 'error') {
					permanentError.current = true
					setError(data.message as string)
					setStatus('error')
				}
			}

			ws.onclose = () => {
				if (cancelled || permanentError.current) { return }
				wsRef.current = null
				setStatus('disconnected')
				reconnectTimer.current = setTimeout(connect, 2000)
			}

			ws.onerror = () => {
				setStatus('error')
			}
		}

		connect()

		return () => {
			cancelled = true
			if (reconnectTimer.current) { clearTimeout(reconnectTimer.current) }
			const ws = wsRef.current
			if (ws) {
				ws.onclose = null
				ws.close()
				wsRef.current = null
			}
		}
	}, [sessionId, simConfig])

	const sendCmd = useCallback((cmd: Record<string, unknown>) => {
		const ws = wsRef.current
		if (!ws || ws.readyState !== WebSocket.OPEN) { return }
		ws.send(JSON.stringify(cmd))
	}, [])

	const press = useCallback((instanceId: string) => {
		sendCmd({ cmd: 'press', instance_id: instanceId })
		setPeripheralState(prev => {
			if (!(instanceId in prev)) { return prev }
			return { ...prev, [instanceId]: { ...prev[instanceId], pressed: true } }
		})
	}, [sendCmd])

	const release = useCallback((instanceId: string) => {
		sendCmd({ cmd: 'release', instance_id: instanceId })
		setPeripheralState(prev => {
			if (!(instanceId in prev)) { return prev }
			return { ...prev, [instanceId]: { ...prev[instanceId], pressed: false } }
		})
	}, [sendCmd])

	const start = useCallback(() => { sendCmd({ cmd: 'start' }) }, [sendCmd])
	const stop = useCallback(() => { sendCmd({ cmd: 'stop' }) }, [sendCmd])
	const restart = useCallback(() => { sendCmd({ cmd: 'restart' }) }, [sendCmd])
	const clearLog = useCallback(() => { setSerialLog([]) }, [])

	return { peripheralState, serialLog, status, error, press, release, start, stop, restart, clearLog }
}
