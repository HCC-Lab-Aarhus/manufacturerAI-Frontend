'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useSetupAgent } from '@/hooks/useSetupAgent'
import { getCircuitResult, getPlacementResult, getSimConfig } from '@/lib/api'
import type { CircuitSpec, PlacementResult } from '@/types/models'
import type { SimConfig } from '@/lib/api/setup'

const DeviceSimulator = dynamic(() => import('@/components/viewport/DeviceSimulator'), { ssr: false })

type RightTab = 'code' | 'simulator'

export default function SetupPanel (): ReactElement {
	const { currentSession, loading } = useSession()
	const { circuit } = usePipeline()
	const {
		messages,
		streaming,
		conversationLoading,
		firmwareCode,
		compiled,
		compileError,
		recompiling,
		tokenUsage,
		runSetup,
		sendFeedback,
		cancel,
		recompile,
		loadConversation,
		resetConversation
	} = useSetupAgent()

	const [rightTab, setRightTab] = useState<RightTab>('simulator')
	const [placement, setPlacement] = useState<PlacementResult | null>(null)
	const [simConfig, setSimConfig] = useState<SimConfig | null>(null)
	const [editingOutline, setEditingOutline] = useState(false)
	const [circuitData, setCircuitData] = useState<CircuitSpec | null>(null)

	const effectiveCircuit = circuit ?? circuitData

	const defaultOutline = useMemo(() => {
		if (!effectiveCircuit) return ''
		const lines = [
			'Generate Arduino firmware for the ATmega328P MCU based on this circuit.',
			'',
			'**Components:**'
		]
		for (const c of effectiveCircuit.components) {
			lines.push(`- ${c.instance_id} (${c.catalog_id})`)
		}
		lines.push('')
		lines.push('**Nets:**')
		for (const n of effectiveCircuit.nets) {
			lines.push(`- ${n.id}: ${n.pins.join(', ')}`)
		}
		lines.push('')
		lines.push(
			'Write complete firmware that initialises all peripherals and implements ' +
			'the expected device behaviour. Use the Arduino framework.'
		)
		return lines.join('\n')
	}, [effectiveCircuit])

	const [outline, setOutline] = useState('')

	useEffect(() => {
		setOutline('')
		setCircuitData(null)
		setPlacement(null)
		setSimConfig(null)
	}, [currentSession?.id])

	useEffect(() => {
		if (defaultOutline && !outline) {
			setOutline(defaultOutline)
		}
	}, [defaultOutline, outline])

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		} else {
			resetConversation()
		}
	}, [currentSession?.id, loadConversation, resetConversation])

	useEffect(() => {
		if (currentSession && !effectiveCircuit) {
			getCircuitResult(currentSession.id).then(setCircuitData).catch(() => {})
		}
	}, [currentSession?.id, effectiveCircuit])

	useEffect(() => {
		if (!currentSession) return
		getPlacementResult(currentSession.id).then(setPlacement).catch(() => {})
		getSimConfig(currentSession.id).then(setSimConfig).catch(() => {})
	}, [currentSession?.id, firmwareCode, compiled])

	const hasManufacture = currentSession?.pipeline_state.gcode === 'complete'
	const hasConversation = messages.length > 0 || streaming
	const hasSimulator = !!placement && !!simConfig && simConfig.peripherals.length > 0 && !!simConfig.elf_path

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

	const handleGenerate = useCallback(() => {
		runSetup(outline || undefined)
	}, [runSetup, outline])

	if (loading) {
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
			{conversationLoading ? (
				<div className="flex flex-1 items-center justify-center">
					<LoadingSpinner size="md" />
				</div>
			) : hasConversation ? (
				<>
					<ChatLog messages={messages} />
					<div className="border-t border-border p-3">
						<ChatInput
							onSend={sendFeedback}
							disabled={streaming}
							placeholder="Give feedback on the firmware…"
							streaming={streaming}
							onStop={cancel}
							tokenUsage={tokenUsage}
						/>
					</div>
				</>
			) : (
				<div className="flex flex-1 flex-col items-center p-2 overflow-hidden">
					<div className="flex w-full max-w-5xl items-center justify-between mb-2">
						<div className="flex items-center gap-3">
							<h2 className="text-lg font-semibold text-fg-secondary">Firmware Outline</h2>
							<button
								onClick={() => setEditingOutline(!editingOutline)}
								className="rounded px-2 py-0.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
							>
								{editingOutline ? 'Preview' : 'Edit'}
							</button>
						</div>
						<button
							onClick={handleGenerate}
							disabled={!currentSession || !outline.trim()}
							className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-on-accent shadow-md hover:bg-accent-hover hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
						>
							{'▶ Generate Firmware'}
						</button>
					</div>
					<div className="flex-1 w-full max-w-5xl overflow-y-auto">
						{editingOutline ? (
							<textarea
								value={outline}
								onChange={e => setOutline(e.target.value)}
								rows={18}
								placeholder="Describe the firmware to generate…"
								className="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-fg placeholder-fg-muted outline-none focus:border-accent transition-colors resize-y"
							/>
						) : (
							<div className="w-full rounded-xl border border-border bg-surface-card px-5 py-4 text-sm text-fg markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
								<Markdown remarkPlugins={[remarkGfm]}>{outline}</Markdown>
							</div>
						)}
					</div>
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
					{!compiled && firmwareCode && (
						<span className="ml-1.5 rounded bg-error/15 px-1 py-0.5 text-[9px] font-medium text-error">
							{'✗'}
						</span>
					)}
					{effectiveTab === 'code' && (
						<span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
					)}
				</button>

				{/* Right-aligned actions */}
				<div className="ml-auto flex items-center gap-2 pr-3">
					{streaming ? (
						<>
							<LoadingSpinner size="sm" label="Generating…" />
							<button
								onClick={cancel}
								className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10 transition-colors"
							>
								{'Stop'}
							</button>
						</>
					) : firmwareCode ? (
						<>
							{!compiled && (
								<button
									onClick={recompile}
									disabled={recompiling}
									className="rounded-lg bg-warning px-3 py-1.5 text-xs font-medium text-on-warning hover:bg-warning/80 disabled:opacity-40 transition-colors"
								>
									{recompiling ? 'Compiling…' : '↻ Compile'}
								</button>
							)}
							<button
								onClick={handleGenerate}
								disabled={!currentSession}
								className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-40 transition-colors"
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

			{/* Compile error banner */}
			{compileError && (
				<div className="flex items-center gap-2 border-b border-error/20 bg-error/10 px-4 py-2 text-xs text-error">
					<span className="flex-1">{compileError}</span>
					<button
						onClick={recompile}
						disabled={recompiling}
						className="shrink-0 rounded bg-error px-2.5 py-1 text-[11px] font-medium text-on-danger hover:bg-error/80 disabled:opacity-40 transition-colors"
					>
						{recompiling ? 'Compiling…' : 'Retry Compile'}
					</button>
				</div>
			)}

			{/* Tab content */}
			<div className="flex-1 overflow-hidden">
				{effectiveTab === 'simulator' && hasSimulator && placement && simConfig && currentSession ? (
					<DeviceSimulator
						placement={placement}
						simConfig={simConfig}
						sessionId={currentSession.id}
						className="w-full h-full"
					/>
				) : effectiveTab === 'code' && firmwareCode ? (
					<div className="h-full overflow-auto">
						<pre className="p-4 text-xs leading-relaxed text-fg font-mono whitespace-pre-wrap wrap-break-word">
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
			<div className={`flex flex-col border-r border-divider ${showRight ? 'w-1/2' : 'flex-1'}`}>
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
