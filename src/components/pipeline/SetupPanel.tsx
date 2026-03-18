'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useState } from 'react'

import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useSession } from '@/contexts/SessionContext'
import { useSetupAgent } from '@/hooks/useSetupAgent'
import { getPlacementResult, getSimConfig } from '@/lib/api'
import type { PlacementResult } from '@/types/models'
import type { SimConfig } from '@/lib/api/setup'

const DeviceSimulator = dynamic(() => import('@/components/viewport/DeviceSimulator'), { ssr: false })

type RightTab = 'code' | 'simulator'

export default function SetupPanel (): ReactElement {
	const { currentSession, loading } = useSession()
	const {
		messages,
		streaming,
		conversationLoading,
		firmwareCode,
		compiled,
		runSetup,
		loadConversation,
		resetConversation
	} = useSetupAgent()

	const [rightTab, setRightTab] = useState<RightTab>('simulator')
	const [placement, setPlacement] = useState<PlacementResult | null>(null)
	const [simConfig, setSimConfig] = useState<SimConfig | null>(null)

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		} else {
			resetConversation()
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	// Load placement + sim config when firmware is ready
	useEffect(() => {
		if (!currentSession) return
		getPlacementResult(currentSession.id).then(setPlacement).catch(() => {})
		getSimConfig(currentSession.id).then(setSimConfig).catch(() => {})
	}, [currentSession?.id, firmwareCode]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasManufacture = currentSession?.pipeline_state.gcode === 'complete' ||
		currentSession?.pipeline_state.gcode === 'done'
	const hasConversation = messages.length > 0 || streaming
	const hasSimulator = !!placement && !!simConfig && simConfig.peripherals.length > 0

	const handleDownload = useCallback(() => {
		if (!firmwareCode) return
		const blob = new Blob([firmwareCode], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'firmware.ino'
		a.click()
		URL.revokeObjectURL(url)
	}, [firmwareCode])

	if (loading || conversationLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<LoadingSpinner size="md" />
			</div>
		)
	}

	if (!hasManufacture) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary text-sm">
				{'Complete the Manufacture stage first'}
			</div>
		)
	}

	/* ── Left column: Chat / Generate ────────────────────────────── */
	const chatColumn = (
		<div className="flex h-full flex-col">
			{hasConversation ? (
				<ChatLog messages={messages} />
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
					<div className="text-center">
						<h2 className="text-lg font-semibold text-fg mb-2">Firmware Generation</h2>
						<p className="text-sm text-fg-secondary max-w-md">
							{'The setup agent will analyze your circuit and generate Arduino firmware for the ATmega328P MCU.'}
						</p>
					</div>
					<button
						onClick={runSetup}
						disabled={!currentSession || streaming}
						className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-accent-hover hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
					>
						{'▶ Generate Firmware'}
					</button>
				</div>
			)}
		</div>
	)

	/* ── Right column: tabbed Code | Simulator ───────────────────── */
	const showRight = firmwareCode || hasSimulator
	const effectiveTab: RightTab = rightTab === 'simulator' && !hasSimulator ? 'code' : rightTab

	const rightColumn = showRight ? (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Tab bar */}
			<div className="flex items-center border-b border-border bg-surface-alt">
				<button
					onClick={() => setRightTab('simulator')}
					disabled={!hasSimulator}
					className={`relative px-4 py-2 text-xs font-medium transition-colors ${
						effectiveTab === 'simulator'
							? 'text-accent-text'
							: hasSimulator
								? 'text-fg-secondary hover:text-fg'
								: 'text-fg-muted cursor-not-allowed'
					}`}
				>
					{'Simulator'}
					{effectiveTab === 'simulator' && (
						<span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
					)}
				</button>
				<button
					onClick={() => setRightTab('code')}
					disabled={!firmwareCode}
					className={`relative px-4 py-2 text-xs font-medium transition-colors ${
						effectiveTab === 'code'
							? 'text-accent-text'
							: firmwareCode
								? 'text-fg-secondary hover:text-fg'
								: 'text-fg-muted cursor-not-allowed'
					}`}
				>
					{'Code'}
					{compiled && (
						<span className="ml-1.5 rounded bg-success/15 px-1 py-0.5 text-[9px] font-medium text-success">
							{'✓'}
						</span>
					)}
					{effectiveTab === 'code' && (
						<span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
					)}
				</button>

				{/* Right-aligned actions */}
				<div className="ml-auto flex items-center gap-2 pr-3">
					{streaming ? (
						<LoadingSpinner size="sm" label="Generating…" />
					) : firmwareCode ? (
						<>
							<button
								onClick={runSetup}
								disabled={!currentSession}
								className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
							>
								{'Re-run'}
							</button>
							<button
								onClick={handleDownload}
								className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover transition-colors"
							>
								{'↓ .ino'}
							</button>
						</>
					) : null}
				</div>
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-hidden">
				{effectiveTab === 'simulator' && hasSimulator && placement && simConfig ? (
					<DeviceSimulator
						placement={placement}
						simConfig={simConfig}
						className="w-full h-full"
					/>
				) : effectiveTab === 'code' && firmwareCode ? (
					<div className="h-full overflow-auto">
						<pre className="p-4 text-xs leading-relaxed text-fg font-mono whitespace-pre-wrap break-words">
							<code>{firmwareCode}</code>
						</pre>
					</div>
				) : (
					<div className="flex h-full items-center justify-center text-fg-muted text-sm">
						{'Generate firmware to see the code and simulator'}
					</div>
				)}
			</div>
		</div>
	) : null

	return (
		<div className="flex h-full">
			<div className={`flex flex-col border-r border-border ${showRight ? 'w-1/2' : 'flex-1'}`}>
				{chatColumn}
			</div>
			{rightColumn && (
				<div className="w-1/2 overflow-hidden">
					{rightColumn}
				</div>
			)}
		</div>
	)
}
