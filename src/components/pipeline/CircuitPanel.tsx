'use client'

import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useCircuitAgent } from '@/hooks/useCircuitAgent'
import type { DesignSpec } from '@/types/models'

function buildOutline (design: DesignSpec): string {
	const desc = design.device_description ?? ''
	const placements = design.ui_placements ?? []
	const lines = [
		'Design the circuit for this device.',
		'',
		'**Device Description:**',
		desc,
		'',
		'**Placed UI Components (use these exact instance_ids):**'
	]
	for (const p of placements) {
		const cid = p.catalog_id ?? p.instance_id ?? '?'
		const iid = p.instance_id ?? '?'
		const face = p.edge_index != null ? 'side' : 'top'
		lines.push(`- ${iid} (${cid}) — ${face} face`)
	}
	lines.push('')
	lines.push(
		'Include these UI components in your circuit. Add all needed internal ' +
		'components (batteries, resistors, MCU, capacitors, etc.) and design ' +
		'the electrical connections.'
	)
	return lines.join('\n')
}

export default function CircuitPanel (): ReactElement {
	const { currentSession } = useSession()
	const { design, circuit, pendingFeedback, setPendingFeedback } = usePipeline()
	const {
		messages,
		streaming,
		conversationLoading,
		runCircuit,
		sendFeedback,
		loadConversation,
		cancel
	} = useCircuitAgent()

	const [viewMode, setViewMode] = useState<'chat' | 'details'>('chat')
	const [editingOutline, setEditingOutline] = useState(false)
	const feedbackSentRef = useRef(false)

	const defaultOutline = useMemo(() => design ? buildOutline(design) : '', [design])
	const [outline, setOutline] = useState('')

	useEffect(() => {
		if (defaultOutline && !outline) {
			setOutline(defaultOutline)
		}
	}, [defaultOutline]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (pendingFeedback?.target === 'circuit' && !streaming && currentSession && !feedbackSentRef.current) {
			feedbackSentRef.current = true
			const msg = pendingFeedback.message
			setPendingFeedback(null)
			sendFeedback(msg)
			setViewMode('chat')
		}
		if (!pendingFeedback) {
			feedbackSentRef.current = false
		}
	}, [pendingFeedback, streaming, currentSession]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasDesign = !!design || currentSession?.pipeline_state.design === 'complete'
	const hasConversation = messages.length > 0 || streaming

	const handleGenerate = useCallback(() => {
		runCircuit(outline || undefined)
	}, [runCircuit, outline])

	if (!hasDesign) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary text-sm">
				{'Complete the Design stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-border px-4 py-1.5">
				<div className="flex items-center gap-1">
					<button
						onClick={() => setViewMode('chat')}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === 'chat' ? 'bg-accent text-white' : 'text-fg-secondary hover:bg-surface-hover'
						}`}
					>
						Chat
					</button>
					<button
						onClick={() => setViewMode('details')}
						disabled={!circuit?.components}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === 'details' ? 'bg-accent text-white' : 'text-fg-secondary hover:bg-surface-hover'
						} disabled:opacity-30`}
					>
						Details
					</button>
				</div>
				{hasConversation && (
					<div className="flex items-center gap-2">
						{streaming ? (
							<>
								<LoadingSpinner size="sm" label="Generating circuit…" />
								<button
									onClick={cancel}
									className="rounded px-2 py-1 text-xs text-danger hover:bg-danger/10 transition-colors"
								>
									{'Stop'}
								</button>
							</>
						) : (
							<button
								onClick={handleGenerate}
								disabled={!currentSession}
								className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
							>
								{'Re-run Circuit'}
							</button>
						)}
					</div>
				)}
			</div>

			<div className="flex-1 overflow-hidden">
				{viewMode === 'details' && circuit?.components ? (
					<div className="overflow-y-auto p-6 h-full">
						<div className="mx-auto max-w-2xl space-y-6">
							<section>
								<h3 className="mb-3 text-sm font-semibold text-fg">
									Components ({circuit.components.length})
								</h3>
								<div className="space-y-2">
									{circuit.components.map(c => (
										<div key={c.instance_id} className="flex items-center gap-3 rounded-xl bg-surface-chip px-4 py-2.5">
											<span className="font-mono text-xs font-semibold text-accent">{c.instance_id}</span>
											<span className="text-sm text-fg">{c.catalog_id}</span>
											{c.mounting_style && (
												<span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">{c.mounting_style}</span>
											)}
										</div>
									))}
								</div>
							</section>

							<section>
								<h3 className="mb-3 text-sm font-semibold text-fg">
									Nets ({circuit.nets.length})
								</h3>
								<div className="space-y-2">
									{circuit.nets.map(n => (
										<div key={n.id} className="rounded-xl bg-surface-chip px-4 py-2.5">
											<span className="font-mono text-xs font-semibold text-accent">{n.id}</span>
											<div className="mt-1 flex flex-wrap gap-1.5">
												{n.pins.map(pin => (
													<span key={pin} className="rounded bg-surface-card px-1.5 py-0.5 text-[11px] font-mono text-fg-secondary">{pin}</span>
												))}
											</div>
										</div>
									))}
								</div>
							</section>
						</div>
					</div>
				) : conversationLoading ? (
					<div className="flex h-full items-center justify-center">
						<LoadingSpinner size="md" />
					</div>
				) : hasConversation ? (
					<div className="flex h-full flex-col">
						<ChatLog messages={messages} />
					</div>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
						<div className="flex items-center gap-3">
							<h2 className="text-lg font-semibold text-fg-secondary">Circuit Outline</h2>
							<button
								onClick={() => setEditingOutline(!editingOutline)}
								className="rounded px-2 py-0.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
							>
								{editingOutline ? 'Preview' : 'Edit'}
							</button>
						</div>
						{editingOutline ? (
							<textarea
								value={outline}
								onChange={e => setOutline(e.target.value)}
								rows={18}
								className="w-full max-w-2xl rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-fg placeholder-fg-muted outline-none focus:border-accent transition-colors resize-y"
							/>
						) : (
							<div className="w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface-card px-5 py-4 text-sm text-fg markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
								<Markdown remarkPlugins={[remarkGfm]}>{outline}</Markdown>
							</div>
						)}
						<button
							onClick={handleGenerate}
							disabled={!currentSession || !outline.trim()}
							className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							Generate Circuit
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
