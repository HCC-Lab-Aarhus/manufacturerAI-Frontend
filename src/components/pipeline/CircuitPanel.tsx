'use client'

import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { getDesignResult } from '@/lib/api'
import { useCircuitAgent } from '@/hooks/useCircuitAgent'
import type { DesignSpec } from '@/types/models'

// Persists across component remounts so auto-revalidation does not
// re-fire when the user is bounced to Design and comes back.
// Keyed by session ID — once auto-revalidation has been attempted for a
// session, it won't auto-fire again (the user can still manually click
// the Re-validate button).
const autoRevalidatedSessions = new Set<string>()

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
	const { currentSession, loading } = useSession()
	const { design, circuit, setDesign, pendingFeedback, setPendingFeedback } = usePipeline()
	const {
		messages,
		streaming,
		conversationLoading,
		tokenUsage,
		runCircuit,
		sendFeedback,
		loadConversation,
		resetConversation,
		revalidate,
		cancel
	} = useCircuitAgent()

	const [editingOutline, setEditingOutline] = useState(false)
	const [revalidating, setRevalidating] = useState(false)
	const feedbackSentRef = useRef(false)

	const defaultOutline = useMemo(() => design ? buildOutline(design) : '', [design])
	const [outline, setOutline] = useState('')

	useEffect(() => {
		if (currentSession && !design) {
			getDesignResult(currentSession.id).then(setDesign).catch(() => {})
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (defaultOutline && !outline) {
			setOutline(defaultOutline)
		}
	}, [defaultOutline]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		} else {
			resetConversation()
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (pendingFeedback?.target === 'circuit' && !streaming && currentSession && !feedbackSentRef.current) {
			feedbackSentRef.current = true
			const msg = pendingFeedback.message
			setPendingFeedback(null)
			sendFeedback(msg)
		}
		if (!pendingFeedback) {
			feedbackSentRef.current = false
		}
	}, [pendingFeedback, streaming, currentSession]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (
			currentSession &&
			!streaming &&
			!conversationLoading &&
			currentSession.artifacts?.circuit_pending &&
			currentSession.pipeline_state.circuit !== 'complete' &&
			currentSession.pipeline_state.circuit !== 'done' &&
			!autoRevalidatedSessions.has(currentSession.id)
		) {
			autoRevalidatedSessions.add(currentSession.id)
			revalidate()
		}
	}, [currentSession?.id, currentSession?.pipeline_state.circuit, currentSession?.artifacts?.circuit_pending, streaming, conversationLoading]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasDesign = !!design || currentSession?.pipeline_state.design === 'complete'
	const hasConversation = messages.length > 0 || streaming
	const hasPendingCircuit = !!currentSession?.artifacts?.circuit_pending

	const handleGenerate = useCallback(() => {
		runCircuit(outline || undefined)
	}, [runCircuit, outline])

	const handleRevalidate = useCallback(async () => {
		setRevalidating(true)
		try {
			await revalidate()
		} finally {
			setRevalidating(false)
			// Re-add to guard so the auto-revalidation effect doesn't
			// fire again after refreshSession updates currentSession.
			if (currentSession) {
				autoRevalidatedSessions.add(currentSession.id)
			}
		}
	}, [revalidate, currentSession])

	if (loading || conversationLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<LoadingSpinner size="md" />
			</div>
		)
	}

	if (!hasDesign) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary text-sm">
				{'Complete the Design stage first'}
			</div>
		)
	}

	const chatColumn = (
		<div className="flex h-full flex-col">
			{hasConversation ? (
				<>
					{hasPendingCircuit && !streaming && (
						<div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface-card">
							<span className="text-xs text-fg-muted">
								{'Circuit pending design update'}
							</span>
							<button
								onClick={handleRevalidate}
								disabled={revalidating}
								className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
							>
								{revalidating ? 'Validating\u2026' : '\u21bb Re-validate'}
							</button>
						</div>
					)}
					<ChatLog messages={messages} />
					<div className="border-t border-border p-3">
						<ChatInput
							onSend={sendFeedback}
							disabled={streaming}
							placeholder="Give feedback on the circuit…"
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
							<h2 className="text-lg font-semibold text-fg-secondary">Circuit Outline</h2>
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
							className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-accent-hover hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
						>
							{'▶ Generate Circuit'}
						</button>
					</div>
					<div className="flex-1 w-full max-w-5xl overflow-y-auto">
						{editingOutline ? (
							<textarea
								value={outline}
								onChange={e => setOutline(e.target.value)}
								rows={18}
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

	const detailsColumn = circuit?.components ? (
		<div className="overflow-y-auto p-6 h-full">
			<div className="mx-auto max-w-2xl space-y-6">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium text-fg-secondary">Details</span>
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
				</div>
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
	) : null

	return (
		<div className="flex h-full">
			<div className={`flex flex-col border-r border-border ${circuit?.components ? 'w-1/2' : 'flex-1'}`}>
				{chatColumn}
			</div>
			{detailsColumn && (
				<div className="w-1/2 overflow-hidden">
					{detailsColumn}
				</div>
			)}
		</div>
	)
}
