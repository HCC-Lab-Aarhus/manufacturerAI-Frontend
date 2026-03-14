'use client'

import { type ReactElement, useEffect } from 'react'

import ChatInput from '@/components/chat/ChatInput'
import ChatLog from '@/components/chat/ChatLog'
import { useSession } from '@/contexts/SessionContext'
import { useDesignAgent } from '@/hooks/useDesignAgent'

export default function DesignPanel (): ReactElement {
	const { currentSession } = useSession()
	const {
		messages,
		streaming,
		sendMessage,
		loadConversation,
		cancel
	} = useDesignAgent()

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasMessages = messages.length > 0

	return (
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

			<div className={`border-t border-stone-200 p-3 ${!hasMessages ? 'mx-auto w-full max-w-xl' : ''}`}>
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
}
