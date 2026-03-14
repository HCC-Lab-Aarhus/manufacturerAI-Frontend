'use client'

import { type ReactElement, useCallback, useEffect, useRef } from 'react'

import type { ChatEntry } from '@/hooks/useDesignAgent'

import ChatMessage, { ToolCallGroup } from './ChatMessage'

interface ChatLogProps {
	messages: ChatEntry[]
}

const SCROLL_THRESHOLD = 150

function groupMessages (messages: ChatEntry[]): (ChatEntry | ChatEntry[])[] {
	const groups: (ChatEntry | ChatEntry[])[] = []
	let toolBuf: ChatEntry[] = []

	const flushTools = () => {
		if (toolBuf.length > 0) {
			groups.push(toolBuf)
			toolBuf = []
		}
	}

	for (const m of messages) {
		if (m.role === 'tool_call' || m.role === 'tool_result') {
			toolBuf.push(m)
		} else {
			flushTools()
			groups.push(m)
		}
	}
	flushTools()
	return groups
}

export default function ChatLog ({ messages }: ChatLogProps): ReactElement {
	const containerRef = useRef<HTMLDivElement>(null)
	const endRef = useRef<HTMLDivElement>(null)
	const lastScrollDirectionRef = useRef<'down' | 'up' | null>(null)
	const prevScrollTopRef = useRef(0)

	const handleScroll = useCallback(() => {
		const el = containerRef.current
		if (!el) { return }
		const top = el.scrollTop
		if (top > prevScrollTopRef.current) {
			lastScrollDirectionRef.current = 'down'
		} else if (top < prevScrollTopRef.current) {
			lastScrollDirectionRef.current = 'up'
		}
		prevScrollTopRef.current = top
	}, [])

	useEffect(() => {
		const el = containerRef.current
		if (!el) { return }
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
		const nearBottom = distanceFromBottom < SCROLL_THRESHOLD
		const scrolledUp = lastScrollDirectionRef.current === 'up'
		if (nearBottom && !scrolledUp) {
			endRef.current?.scrollIntoView({ behavior: 'smooth' })
		}
	}, [messages])

	if (messages.length === 0) {
		return <div ref={containerRef} className="flex-1" />
	}

	const grouped = groupMessages(messages)

	return (
		<div
			ref={containerRef}
			onScroll={handleScroll}
			className="flex flex-1 flex-col gap-2 overflow-y-auto p-4"
		>
			{grouped.map((item, i) => {
				if (Array.isArray(item)) {
					return <ToolCallGroup key={`tg-${i}`} entries={item} />
				}
				return <ChatMessage key={item.id} entry={item} />
			})}
			<div ref={endRef} />
		</div>
	)
}
