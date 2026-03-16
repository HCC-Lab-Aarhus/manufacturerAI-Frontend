'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
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
		resetConversation,
		cancel
	} = useDesignAgent()

	const feedbackSentRef = useRef(false)

	const scene3dDesignRef = useRef(design)
	const [scene3dDesign, setScene3dDesign] = useState(design)
	const scene3dTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Resizable panel sizes (percentages)
	const [chatWidthPct, setChatWidthPct] = useState(50)
	const [outlineHeightPct, setOutlineHeightPct] = useState(50)
	const containerRef = useRef<HTMLDivElement>(null)
	const rightColRef = useRef<HTMLDivElement>(null)

	const handleDesignUpdate = useCallback((d: DesignSpec | null) => {
		setDesign(d)
		scene3dDesignRef.current = d
		if (scene3dTimerRef.current) clearTimeout(scene3dTimerRef.current)
		scene3dTimerRef.current = setTimeout(() => {
			setScene3dDesign(scene3dDesignRef.current)
			scene3dTimerRef.current = null
		}, 500)
	}, [setDesign])

	useEffect(() => {
		scene3dDesignRef.current = design
		if (!scene3dTimerRef.current) {
			setScene3dDesign(design)
		}
	}, [design])

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		} else {
			resetConversation()
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
					tokenUsage={tokenUsage}
				/>
			</div>
		</div>
	)

	return (
		<div ref={containerRef} className="flex h-full">
			<div className="flex flex-col border-r border-border overflow-hidden" style={{ width: design ? `${chatWidthPct}%` : '100%' }}>
				{chatColumn}
			</div>

			{design && (
				<>
					{/* Horizontal drag handle: chat | right */}
					<div
						className="w-1 cursor-col-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors shrink-0"
						onPointerDown={e => {
							e.preventDefault()
							const el = e.currentTarget
							el.setPointerCapture(e.pointerId)
							el.onpointermove = (ev: PointerEvent) => {
								const container = containerRef.current
								if (!container) return
								const rect = container.getBoundingClientRect()
								const pct = Math.min(80, Math.max(20, (ev.clientX - rect.left) / rect.width * 100))
								setChatWidthPct(pct)
							}
							el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null }
						}}
					/>

					<div ref={rightColRef} className="flex flex-col overflow-hidden flex-1">
						<div className="overflow-hidden" style={{ height: `${outlineHeightPct}%` }}>
							<DesignViewport
								design={design as DesignSpec & { pcb_contour?: [number, number][] }}
								sessionId={currentSession?.id}
								onDesignUpdate={handleDesignUpdate}
								onDesignSubmitted={notifyDesignEdited}
								className="w-full h-full"
							/>
						</div>

						{/* Vertical drag handle: outline | 3D */}
						<div
							className="h-1 cursor-row-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors shrink-0"
							onPointerDown={e => {
								e.preventDefault()
								const el = e.currentTarget
								el.setPointerCapture(e.pointerId)
								el.onpointermove = (ev: PointerEvent) => {
									const col = rightColRef.current
									if (!col) return
									const rect = col.getBoundingClientRect()
									const pct = Math.min(80, Math.max(20, (ev.clientY - rect.top) / rect.height * 100))
									setOutlineHeightPct(pct)
								}
								el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null }
							}}
						/>

						<div className="overflow-hidden flex-1">
							<Scene3D design={scene3dDesign} className="w-full h-full" />
						</div>
					</div>
				</>
			)}
		</div>
	)
}
