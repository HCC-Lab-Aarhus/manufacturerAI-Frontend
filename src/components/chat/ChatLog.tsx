'use client'

import { type ReactElement, useEffect, useRef } from 'react'

import type { ChatEntry } from '@/hooks/useDesignAgent'

import ChatMessage from './ChatMessage'

interface ChatLogProps {
	messages: ChatEntry[]
}

export default function ChatLog ({ messages }: ChatLogProps): ReactElement {
	const endRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	if (messages.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center text-neutral-500 text-sm">
				{'No messages yet'}
			</div>
		)
	}

	return (
		<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
			{messages.map(entry => (
				<ChatMessage key={entry.id} entry={entry} />
			))}
			<div ref={endRef} />
		</div>
	)
}
