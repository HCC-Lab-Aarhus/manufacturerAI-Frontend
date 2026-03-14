'use client'

import { type ReactElement, useEffect, useState } from 'react'

import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useCircuitAgent } from '@/hooks/useCircuitAgent'

export default function CircuitPanel (): ReactElement {
	const { currentSession } = useSession()
	const { design, circuit } = usePipeline()
	const {
		messages,
		streaming,
		runCircuit,
		loadConversation,
		cancel
	} = useCircuitAgent()

	const [viewMode, setViewMode] = useState<'chat' | 'details'>('chat')

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasDesign = !!design || currentSession?.pipeline_state.design === 'complete'

	if (!hasDesign) {
		return (
			<div className="flex h-full items-center justify-center text-stone-600 text-sm">
				{'Complete the Design stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-stone-200 px-4 py-1.5">
				<div className="flex items-center gap-1">
					<button
						onClick={() => setViewMode('chat')}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === 'chat' ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
						}`}
					>
						Chat
					</button>
					<button
						onClick={() => setViewMode('details')}
						disabled={!circuit}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === 'details' ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
						} disabled:opacity-30`}
					>
						Details
					</button>
				</div>
				<div className="flex items-center gap-2">
					{streaming ? (
						<>
							<LoadingSpinner size="sm" label="Generating circuit…" />
							<button
								onClick={cancel}
								className="rounded px-2 py-1 text-xs text-danger hover:bg-rose-50 transition-colors"
							>
								{'Stop'}
							</button>
						</>
					) : (
						<button
							onClick={runCircuit}
							disabled={!currentSession}
							className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
						>
							{messages.length > 0 ? 'Re-run Circuit' : 'Generate Circuit'}
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-hidden">
				{viewMode === 'details' && circuit ? (
					<div className="overflow-y-auto p-6 h-full">
						<div className="mx-auto max-w-2xl space-y-6">
							<section>
								<h3 className="mb-3 text-sm font-semibold text-stone-700">
									Components ({circuit.components.length})
								</h3>
								<div className="space-y-2">
									{circuit.components.map(c => (
										<div key={c.instance_id} className="flex items-center gap-3 rounded-xl bg-[#efeee9] px-4 py-2.5">
											<span className="font-mono text-xs font-semibold text-accent">{c.instance_id}</span>
											<span className="text-sm text-stone-700">{c.catalog_id}</span>
											{c.mounting_style && (
												<span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] uppercase text-stone-500">{c.mounting_style}</span>
											)}
										</div>
									))}
								</div>
							</section>

							<section>
								<h3 className="mb-3 text-sm font-semibold text-stone-700">
									Nets ({circuit.nets.length})
								</h3>
								<div className="space-y-2">
									{circuit.nets.map(n => (
										<div key={n.id} className="rounded-xl bg-[#efeee9] px-4 py-2.5">
											<span className="font-mono text-xs font-semibold text-accent">{n.id}</span>
											<div className="mt-1 flex flex-wrap gap-1.5">
												{n.pins.map(pin => (
													<span key={pin} className="rounded bg-white px-1.5 py-0.5 text-[11px] font-mono text-stone-600">{pin}</span>
												))}
											</div>
										</div>
									))}
								</div>
							</section>
						</div>
					</div>
				) : (
					<ChatLog messages={messages} />
				)}
			</div>
		</div>
	)
}
