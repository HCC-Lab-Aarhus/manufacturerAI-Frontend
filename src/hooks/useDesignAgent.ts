'use client'

import { useCallback, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import {
	startDesign,
	streamDesignEvents,
	getDesignStatus,
	stopDesign,
	getDesignConversation,
	getDesignResult,
	getTokenUsage
} from '@/lib/api'
import { createSession } from '@/lib/api/sessions'
import type { SSEEventType } from '@/types/events'
import type { DesignSpec, TokenUsage } from '@/types/models'

export interface ChatEntry {
	id: string
	role: 'user' | 'assistant' | 'thinking' | 'tool_call' | 'tool_result' | 'status'
	content: string
	toolName?: string
	toolUseId?: string
	isError?: boolean
	isStreaming?: boolean
	isCompletion?: boolean
}

export function useDesignAgent () {
	const { currentSession, selectSession, setActiveStage, refreshSession, refreshSessions, patchSession } = useSession()
	const { setDesign } = usePipeline()
	const { addError } = useError()

	const [messages, setMessages] = useState<ChatEntry[]>([])
	const [streaming, setStreaming] = useState(false)
	const [_conversationLoading, setConversationLoading] = useState(false)
	const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
	const loadedSessionRef = useRef<string | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const streamingRef = useRef(false)
	const sentFirstRef = useRef(false)
	const idCounter = useRef(0)
	const eventCursor = useRef(0)
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

	const handleEvent = useCallback((type: SSEEventType, data: unknown) => {
		eventCursor.current++
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
					toolName: d.name as string,
					toolUseId: d.id as string
				})
				break
			case 'tool_result':
				appendMessage({
					id: nextId('tool-result'),
					role: 'tool_result',
					content: d.content as string,
					toolName: d.name as string,
					toolUseId: d.id as string,
					isError: d.is_error as boolean
				})
				break
			case 'design':
				setDesign((d.design ?? d) as unknown as DesignSpec)
				break
			case 'invalidated':
				patchSession({
					invalidated_steps: d.invalidated_steps as string[],
					artifacts: d.artifacts as Record<string, boolean>,
					pipeline_errors: d.pipeline_errors as Record<string, import('@/types/models').PipelineError>,
				})
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
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content: 'Design agent finished',
					isCompletion: true
				})
				break
		}
	}, [appendMessage, updateLastAssistant, updateLastThinking, setDesign, patchSession, addError, nextId, refreshSession])

	const subscribeToStream = useCallback((sessionId: string, after: number = 0) => {
		abortRef.current?.abort()
		eventCursor.current = after
		abortRef.current = streamDesignEvents(
			sessionId,
			{
				onEvent: handleEvent,
				onError: (err) => {
					addError(err)
					streamingRef.current = false
					setStreaming(false)
				},
				onDone: () => {
					streamingRef.current = false
					setStreaming(false)
					refreshSession()
				}
			},
			after
		)
	}, [handleEvent, addError, refreshSession])

	const sendMessage = useCallback(async (prompt: string) => {
		if (streaming) { return }

		setStreaming(true)
		streamingRef.current = true
		sentFirstRef.current = true

		let sessionId = currentSession?.id
		if (!sessionId) {
			const { session_id } = await createSession()
			sessionId = session_id
			refreshSessions()
			selectSession(sessionId)
			setActiveStage('design')
		}

		appendMessage({
			id: nextId('user'),
			role: 'user',
			content: prompt
		})

		try {
			await startDesign(prompt, sessionId)
			subscribeToStream(sessionId, 0)
		} catch (err) {
			addError(err)
			streamingRef.current = false
			setStreaming(false)
		}
	}, [streaming, currentSession, appendMessage, subscribeToStream, refreshSessions, selectSession, setActiveStage, addError, nextId])

	const loadConversation = useCallback(async (sessionId: string) => {
		if (streamingRef.current) return
		sentFirstRef.current = false
		setMessages([])
		setConversationLoading(true)
		try {
			const status = await getDesignStatus(sessionId).catch(() => null)
			const isRunning = status?.status === 'running'

			if (isRunning) {
				await new Promise(resolve => setTimeout(resolve, 150))
			}

			const [convo, design, freshStatus, tokens] = await Promise.all([
				getDesignConversation(sessionId),
				getDesignResult(sessionId).catch(() => null),
				isRunning ? getDesignStatus(sessionId).catch(() => null) : Promise.resolve(null),
				getTokenUsage(sessionId).catch(() => null)
			])

			if (tokens) setTokenUsage(tokens)

			const entries: ChatEntry[] = []
			for (const msg of convo) {
				if (typeof msg.content === 'string') {
					entries.push({
						id: `l-${msg.role}-${entries.length}`,
						role: msg.role,
						content: msg.content
					})
				} else if (Array.isArray(msg.content)) {
					for (const block of msg.content) {
						if (block.type === 'text' && block.text) {
							let isInteractiveDesigner = false
							try {
								const parsed = JSON.parse(block.text)
								if (parsed?.source === 'interactive_designer') {
									isInteractiveDesigner = true
								}
							} catch { /* not JSON */ }
							if (isInteractiveDesigner) {
								entries.push({
									id: `l-status-${entries.length}`,
									role: 'status',
									content: 'Design updated from editor'
								})
							} else {
								entries.push({
									id: `l-${msg.role}-${entries.length}`,
									role: msg.role,
									content: block.text
								})
							}
						} else if (block.type === 'thinking' && block.thinking) {
							entries.push({
								id: `l-thinking-${entries.length}`,
								role: 'thinking',
								content: block.thinking
							})
						} else if (block.type === 'tool_use') {
							entries.push({
								id: `l-tool-call-${entries.length}`,
								role: 'tool_call',
								content: JSON.stringify(block.input, null, 2),
								toolName: block.name,
								toolUseId: block.id
							})
						} else if (block.type === 'tool_result') {
							entries.push({
								id: `l-tool-result-${entries.length}`,
								role: 'tool_result',
								content: block.content ?? '',
								toolName: block.name,
								toolUseId: block.tool_use_id,
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

			if (!isRunning && entries.length > 0 && design) {
				entries.push({
					id: `l-status-done`,
					role: 'status',
					content: 'Design validated and saved',
					isCompletion: true
				})
				setMessages([...entries])
			}

			if (isRunning) {
				const cursor = freshStatus?.last_save_cursor ?? status?.last_save_cursor ?? 0
				setStreaming(true)
				streamingRef.current = true
				subscribeToStream(sessionId, cursor)
			}
		} catch {
			setMessages([])
		} finally {
			loadedSessionRef.current = sessionId
			setConversationLoading(false)
		}
	}, [setDesign, subscribeToStream])

	const conversationLoading = _conversationLoading || (currentSession?.id != null && loadedSessionRef.current !== currentSession.id)

	const cancel = useCallback(async () => {
		abortRef.current?.abort()
		streamingRef.current = false
		setStreaming(false)
		if (currentSession?.id) {
			try {
				await stopDesign(currentSession.id)
			} catch { /* already stopped */ }
		}
	}, [currentSession])

	const resetConversation = useCallback(() => {
		abortRef.current?.abort()
		streamingRef.current = false
		setStreaming(false)
		setMessages([])
		setTokenUsage(null)
		loadedSessionRef.current = null
		idCounter.current = 0
		eventCursor.current = 0
	}, [])

	const notifyDesignEdited = useCallback(() => {
		setMessages(prev => {
			const last = prev[prev.length - 1]
			if (last?.role === 'status' && last.content === 'Design updated from editor') {
				return prev
			}
			return [...prev, {
				id: nextId('status'),
				role: 'status' as const,
				content: 'Design updated from editor'
			}]
		})
	}, [nextId])

	return {
		messages,
		streaming,
		conversationLoading,
		tokenUsage,
		sendMessage,
		loadConversation,
		resetConversation,
		notifyDesignEdited,
		cancel
	}
}
