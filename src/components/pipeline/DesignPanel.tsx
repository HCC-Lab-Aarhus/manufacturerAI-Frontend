'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TokenMeter from '@/components/ui/TokenMeter'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { useDesignAgent } from '@/hooks/useDesignAgent'
import type { DesignSpec } from '@/types/models'

const DesignViewport = dynamic(() => import('@/components/viewport/DesignViewport'), { ssr: false })
const Scene3D = dynamic(() => import('@/components/viewport/Scene3D'), { ssr: false })

export default function DesignPanel (): ReactElement {
	const { currentSession, loading } = useSession()
	const { design, setDesign, pendingFeedback, setPendingFeedback } = usePipeline()
	const {
		messages,
		streaming,
		conversationLoading,
		tokenUsage,
		sendMessage,
		loadConversation,
		notifyDesignEdited,
		cancel
	} = useDesignAgent()

	const feedbackSentRef = useRef(false)

	const scene3dDesignRef = useRef(design)
	const [scene3dDesign, setScene3dDesign] = useState(design)
	const scene3dTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleDesignUpdate = useCallback((d: DesignSpec | null) => {
		setDesign(d)
		scene3dDesignRef.current = d
		if (scene3dTimerRef.current) clearTimeout(scene3dTimerRef.current)
		scene3dTimerRef.current = setTimeout(() => {
			setScene3dDesign(scene3dDesignRef.current)
		}, 500)
	}, [setDesign])

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (pendingFeedback?.target === 'design' && !streaming && currentSession && !feedbackSentRef.current) {
			feedbackSentRef.current = true
			const msg = pendingFeedback.message
			setPendingFeedback(null)
			sendMessage(msg)
		}
		if (!pendingFeedback) {
			feedbackSentRef.current = false
		}
	}, [pendingFeedback, streaming, currentSession]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasMessages = messages.length > 0

	const chatColumn = (
		<div className="flex h-full flex-col">
			{(conversationLoading || loading) ? (
				<div className="flex flex-1 items-center justify-center">
					<LoadingSpinner size="md" />
				</div>
			) : hasMessages ? (
				<ChatLog messages={messages} />
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 text-fg-secondary">
					<h2 className="text-xl font-semibold text-fg-secondary">{'ManufacturerAI'}</h2>
					<p className="max-w-md text-center text-sm">
						{'Describe what hardware device you want to build and the design agent will help you create it.'}
					</p>
				</div>
			)}
			<div className={`border-t border-border p-3 ${!hasMessages ? 'mx-auto w-full max-w-xl' : ''}`}>
				<ChatInput
					onSend={sendMessage}
					disabled={streaming}
					placeholder="Describe your device…"
					streaming={streaming}
					onStop={cancel}
				/>
			</div>
		</div>
	)

	return (
		<div className="flex h-full">
			<div className={`flex flex-col border-r border-border ${design ? 'w-1/2' : 'flex-1'}`}>
				<div className="flex items-center justify-between border-b border-border px-4 py-1.5">
					<span className="text-xs font-medium text-fg-secondary">Chat</span>
					<TokenMeter usage={tokenUsage} />
				</div>
				{chatColumn}
			</div>

			{design && (
				<div className="flex w-1/2 flex-col">
					<div className="flex-1 border-b border-border overflow-hidden">
						<DesignViewport
							design={design as DesignSpec & { pcb_contour?: [number, number][] }}
							sessionId={currentSession?.id}
							onDesignUpdate={handleDesignUpdate}
							onDesignSubmitted={notifyDesignEdited}
							className="w-full h-full"
						/>
					</div>
					<div className="flex-1 overflow-hidden">
						<Scene3D design={scene3dDesign} className="w-full h-full" />
					</div>
				</div>
			)}
		</div>
	)
}
