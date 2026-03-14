'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useEffect, useState } from 'react'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import TokenMeter from '@/components/ui/TokenMeter'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useDesignAgent } from '@/hooks/useDesignAgent'
import type { DesignSpec } from '@/types/models'

const DesignViewport = dynamic(() => import('@/components/viewport/DesignViewport'), { ssr: false })
const Scene3D = dynamic(() => import('@/components/viewport/Scene3D'), { ssr: false })

export default function DesignPanel (): ReactElement {
	const { currentSession } = useSession()
	const { design } = usePipeline()
	const {
		messages,
		streaming,
		tokenUsage,
		sendMessage,
		loadConversation,
		cancel
	} = useDesignAgent()

	const [viewMode, setViewMode] = useState<'chat' | '2d' | '3d'>('chat')

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasMessages = messages.length > 0

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
						onClick={() => setViewMode('2d')}
						disabled={!design}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === '2d' ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
						} disabled:opacity-30`}
					>
						2D
					</button>
					<button
						onClick={() => setViewMode('3d')}
						disabled={!design}
						className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
							viewMode === '3d' ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
						} disabled:opacity-30`}
					>
						3D
					</button>
				</div>
				<TokenMeter usage={tokenUsage} />
			</div>

			<div className="flex-1 overflow-hidden">
				{viewMode === '2d' && design ? (
					<DesignViewport design={design as DesignSpec & { pcb_contour?: [number, number][] }} className="w-full h-full" />
				) : viewMode === '3d' && design ? (
					<Scene3D placement={null} routing={null} className="w-full h-full" />
				) : (
					<div className="flex h-full flex-col">
						{hasMessages ? (
							<ChatLog messages={messages} />
						) : (
							<div className="flex flex-1 flex-col items-center justify-center gap-4 text-stone-600">
								<h2 className="text-xl font-semibold text-stone-600">{'ManufacturerAI'}</h2>
								<p className="max-w-md text-center text-sm">
									{'Describe what hardware device you want to build and the design agent will help you create it.'}
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			{(viewMode === 'chat') && (
				<div className={`border-t border-stone-200 p-3 ${!hasMessages ? 'mx-auto w-full max-w-xl' : ''}`}>
					<ChatInput
						onSend={sendMessage}
						disabled={streaming}
						placeholder="Describe your device…"
						streaming={streaming}
						onStop={cancel}
					/>
				</div>
			)}
		</div>
	)
}
