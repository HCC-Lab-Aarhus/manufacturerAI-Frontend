'use client'

import { type ReactElement, useEffect } from 'react'

import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useCircuitAgent } from '@/hooks/useCircuitAgent'

export default function CircuitPanel (): ReactElement {
	const { currentSession } = useSession()
	const { design } = usePipeline()
	const {
		messages,
		streaming,
		runCircuit,
		loadConversation,
		cancel
	} = useCircuitAgent()

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasDesign = !!design || currentSession?.pipeline_state.design === 'complete'

	if (!hasDesign) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
				{'Complete the Design stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'Circuit Agent'}</h2>
				<div className="flex items-center gap-2">
					{streaming ? (
						<>
							<LoadingSpinner size="sm" label="Generating circuit…" />
							<button
								onClick={cancel}
								className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
							>
								{'Stop'}
							</button>
						</>
					) : (
						<button
							onClick={runCircuit}
							disabled={!currentSession}
							className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
						>
							{messages.length > 0 ? 'Re-run Circuit' : 'Generate Circuit'}
						</button>
					)}
				</div>
			</div>

			<ChatLog messages={messages} />
		</div>
	)
}
