'use client'

import { useCallback, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { streamDesign, getDesignConversation, getDesignResult } from '@/lib/api'
import { createSession } from '@/lib/api/sessions'
import type { SSEEventType } from '@/types/events'
import type { DesignSpec, TokenUsage } from '@/types/models'

export interface ChatEntry {
	id: string
	role: 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result'
	content: string
	toolName?: string
	isError?: boolean
	isStreaming?: boolean
}

export function useDesignAgent () {
	const { currentSession, selectSession, refreshSession, refreshSessions } = useSession()
	const { setDesign } = usePipeline()
	const { addError } = useError()

	const [messages, setMessages] = useState<ChatEntry[]>([])
	const [streaming, setStreaming] = useState(false)
	const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const sentFirstRef = useRef(false)
	const idCounter = useRef(0)
	const nextId = useCallback((prefix: string) => `${prefix}-${++idCounter.current}`, [])

	const appendMessage = useCallback((entry: ChatEntry) => {
		setMessages(prev => [...prev, entry])
	}, [])

	const updateLastAssistant = useCallback((text: string) => {
		setMessages(prev => {
			const copy = [...prev]
			for (let i = copy.length - 1; i >= 0; i--) {
				if (copy[i].role === 'assistant' && copy[i].isStreaming) {
					copy[i] = { ...copy[i], content: copy[i].content + text }
					return copy
				}
			}
			return prev
		})
	}, [])

	const updateLastThinking = useCallback((text: string) => {
		setMessages(prev => {
			const copy = [...prev]
			for (let i = copy.length - 1; i >= 0; i--) {
				if (copy[i].role === 'thinking' && copy[i].isStreaming) {
					copy[i] = { ...copy[i], content: copy[i].content + text }
					return copy
				}
			}
			return prev
		})
	}, [])

	const sendMessage = useCallback(async (prompt: string) => {
		if (streaming) { return }

		appendMessage({
			id: nextId('user'),
			role: 'user',
			content: prompt
		})

		setStreaming(true)
		sentFirstRef.current = true

		let sessionId = currentSession?.id
		if (!sessionId) {
			const { session_id } = await createSession()
			sessionId = session_id
			refreshSessions()
			selectSession(sessionId)
		}

		const handleEvent = (type: SSEEventType, data: unknown) => {
			const d = data as Record<string, unknown>
			switch (type) {
				case 'thinking_start':
					appendMessage({
						id: nextId('thinking'),
						role: 'thinking',
						content: '',
						isStreaming: true
					})
					break
				case 'thinking_delta':
					updateLastThinking((d.text as string) ?? '')
					break
				case 'message_start':
					appendMessage({
						id: nextId('assistant'),
						role: 'assistant',
						content: '',
						isStreaming: true
					})
					break
				case 'message_delta':
					updateLastAssistant((d.text as string) ?? '')
					break
				case 'block_stop':
					setMessages(prev =>
						prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m)
					)
					break
				case 'tool_call':
					appendMessage({
						id: nextId('tool-call'),
						role: 'tool_call',
						content: JSON.stringify(d.input, null, 2),
						toolName: d.name as string
					})
					break
				case 'tool_result':
					appendMessage({
						id: nextId('tool-result'),
						role: 'tool_result',
						content: d.content as string,
						toolName: d.name as string,
						isError: d.is_error as boolean
					})
					break
				case 'design':
					setDesign((d.design ?? d) as unknown as DesignSpec)
					break
				case 'token_usage':
					setTokenUsage({
						input_tokens: d.input_tokens as number,
						budget: d.budget as number ?? 50000
					})
					break
				case 'session_named':
					refreshSession()
					break
				case 'error':
					addError(d.message ?? d)
					break
				case 'done':
					break
			}
		}

		abortRef.current = streamDesign(
			prompt,
			{
				onEvent: handleEvent,
				onError: (err) => {
					addError(err)
					setStreaming(false)
				},
				onDone: () => {
					setStreaming(false)
					refreshSession()
				}
			},
			sessionId
		)
	}, [streaming, currentSession, appendMessage, updateLastAssistant, updateLastThinking, setDesign, refreshSession, refreshSessions, selectSession, addError, nextId])

	const loadConversation = useCallback(async (sessionId: string) => {
		if (sentFirstRef.current) { return }
		try {
			const [convo, design] = await Promise.all([
				getDesignConversation(sessionId),
				getDesignResult(sessionId).catch(() => null)
			])

			const entries: ChatEntry[] = []
			for (const msg of convo) {
				if (typeof msg.content === 'string') {
					entries.push({
						id: `${msg.role}-${entries.length}`,
						role: msg.role,
						content: msg.content
					})
				} else if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === 'text' && block.text) {
							entries.push({
								id: `${msg.role}-${entries.length}`,
								role: msg.role,
								content: block.text
							})
						} else if (block.type === 'thinking' && block.thinking) {
							entries.push({
								id: `thinking-${entries.length}`,
								role: 'thinking',
								content: block.thinking
							})
						} else if (block.type === 'tool_use') {
							entries.push({
								id: `tool-call-${entries.length}`,
								role: 'tool_call',
								content: JSON.stringify(block.input, null, 2),
								toolName: block.name
							})
						} else if (block.type === 'tool_result') {
							entries.push({
								id: `tool-result-${entries.length}`,
								role: 'tool_result',
								content: block.content ?? '',
								toolName: block.name,
								isError: block.is_error
							})
						}
					}
				}
			}
			setMessages(entries)

			if (design) {
				setDesign(design)
			}
		} catch {
			setMessages([])
		}
	}, [setDesign])

	const cancel = useCallback(() => {
		abortRef.current?.abort()
		setStreaming(false)
	}, [])

	return {
		messages,
		streaming,
		tokenUsage,
		sendMessage,
		loadConversation,
		cancel
	}
}
