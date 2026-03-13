'use client'

import { type ReactElement, useEffect } from 'react'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import TokenMeter from '@/components/ui/TokenMeter'
import { useSession } from '@/contexts/SessionContext'
import { useDesignAgent } from '@/hooks/useDesignAgent'

export default function DesignPanel (): ReactElement {
	const { currentSession } = useSession()
	const {
		messages,
		streaming,
		tokenUsage,
		sendMessage,
		loadConversation,
		cancel
	} = useDesignAgent()

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'Design Agent'}</h2>
				<div className="flex items-center gap-3">
					<TokenMeter usage={tokenUsage} />
					{streaming && (
						<button
							onClick={cancel}
							className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
						>
							{'Stop'}
						</button>
					)}
				</div>
			</div>

			<ChatLog messages={messages} />

			<div className="border-t border-neutral-800 p-3">
				<ChatInput
					onSend={sendMessage}
					disabled={streaming}
					placeholder="Describe your device…"
				/>
			</div>
		</div>
	)
}
