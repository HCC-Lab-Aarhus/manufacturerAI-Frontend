'use client'

import { useCallback, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import {
	startCircuit,
	streamCircuitEvents,
	getCircuitStatus,
	stopCircuit,
	getCircuitConversation,
	getCircuitResult,
	getCircuitTokenUsage,
	revalidateCircuit
} from '@/lib/api'
import type { SSEEventType } from '@/types/events'
import type { CircuitSpec, TokenUsage } from '@/types/models'

import type { ChatEntry } from './useDesignAgent'

export function useCircuitAgent () {
	const { currentSession, refreshSession, patchSession, setActiveStage } = useSession()
	const { setCircuit, setPendingFeedback } = usePipeline()
	const { addError } = useError()

	const [messages, setMessages] = useState<ChatEntry[]>([])
	const [streaming, setStreaming] = useState(false)
	const [_conversationLoading, setConversationLoading] = useState(false)
	const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
	const loadedSessionRef = useRef<string | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const streamingRef = useRef(false)
	const circuitReceivedRef = useRef(false)
	const designFeedbackRef = useRef(false)
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
			case 'circuit':
				circuitReceivedRef.current = true
				setCircuit((d.circuit ?? d) as unknown as CircuitSpec)
				break
			case 'design_feedback':
				designFeedbackRef.current = true
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content:
						'Enclosure dimensions are incompatible with the circuit:\n\n' +
						(d.message as string) +
						'\n\nPlease go to the Design tab and adjust the enclosure.',
					isError: true
				})
				break
			case 'invalidated':
				patchSession({
					invalidated_steps: d.invalidated_steps as string[],
					artifacts: d.artifacts as Record<string, boolean>,
					pipeline_errors: d.pipeline_errors as Record<string, import('@/types/models').PipelineError>
				})
				break
			case 'error': {
				const msg = String(d.message ?? d)
				if (msg !== 'Cancelled') addError(msg)
				break
			}
			case 'token_usage':
				setTokenUsage(d as unknown as TokenUsage)
				break
			case 'done': {
				const content = designFeedbackRef.current
					? 'Circuit saved — enclosure adjustment requested from design agent'
					: circuitReceivedRef.current
						? 'Circuit validated and saved'
						: 'Circuit agent finished'
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content,
					isCompletion: true
				})
				break
			}
		}
	}, [appendMessage, updateLastAssistant, updateLastThinking, setCircuit, patchSession, addError, nextId])

	const subscribeToStream = useCallback((sessionId: string, after: number = 0) => {
		abortRef.current?.abort()
		eventCursor.current = after
		abortRef.current = streamCircuitEvents(
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

	const runCircuit = useCallback(async (outline?: string) => {
		if (!currentSession || streamingRef.current) { return }
		setMessages([])
		setCircuit(null)
		setStreaming(true)
		streamingRef.current = true
		circuitReceivedRef.current = false
		designFeedbackRef.current = false
		if (outline) {
			appendMessage({ id: nextId('user'), role: 'user', content: outline })
		}
		try {
			await startCircuit(currentSession.id, undefined, outline)
			subscribeToStream(currentSession.id, 0)
		} catch (err) {
			addError(err)
			streamingRef.current = false
			setStreaming(false)
		}
	}, [currentSession, setCircuit, appendMessage, nextId, subscribeToStream, addError])

	const sendFeedback = useCallback(async (feedback: string) => {
		if (!currentSession || streamingRef.current) { return }
		appendMessage({
			id: nextId('user'),
			role: 'user',
			content: feedback
		})
		setStreaming(true)
		streamingRef.current = true
		circuitReceivedRef.current = false
		designFeedbackRef.current = false
		try {
			await startCircuit(currentSession.id, feedback)
			subscribeToStream(currentSession.id, 0)
		} catch (err) {
			addError(err)
			streamingRef.current = false
			setStreaming(false)
		}
	}, [currentSession, appendMessage, nextId, subscribeToStream, addError])

	const loadConversation = useCallback(async (sessionId: string) => {
		if (streamingRef.current) {
			loadedSessionRef.current = sessionId
			return
		}
		setConversationLoading(true)

		getCircuitTokenUsage(sessionId).then(t => { if (t) setTokenUsage(t) }).catch(() => {})

		try {
			const [status, convo, circuit] = await Promise.all([
				getCircuitStatus(sessionId).catch(() => null),
				getCircuitConversation(sessionId),
				getCircuitResult(sessionId).catch(() => null),
			])
			const isRunning = status?.status === 'running'

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
							entries.push({
								id: `l-${msg.role}-${entries.length}`,
								role: msg.role,
								content: block.text
							})
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
								toolUseId: block.tool_use_id
							})
						}
					}
				}
			}
			setMessages(entries)

			if (circuit) {
				setCircuit(circuit)
			}

			if (!isRunning && entries.length > 0 && circuit) {
				entries.push({
					id: `l-status-done`,
					role: 'status',
					content: 'Circuit validated and saved',
					isCompletion: true
				})
				setMessages([...entries])
			}

			if (isRunning) {
				const cursor = status?.last_save_cursor ?? 0
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
	}, [setCircuit, subscribeToStream])

	const conversationLoading = _conversationLoading || (currentSession?.id != null && loadedSessionRef.current !== currentSession.id)

	const cancel = useCallback(async () => {
		abortRef.current?.abort()
		streamingRef.current = false
		setStreaming(false)
		if (currentSession?.id) {
			try {
				await stopCircuit(currentSession.id)
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
	}, [])

	const revalidate = useCallback(async () => {
		if (!currentSession || streamingRef.current) { return false }
		try {
			const result = await revalidateCircuit(currentSession.id)
			if (result.valid) {
				if (result.circuit) {
					setCircuit(result.circuit as unknown as CircuitSpec)
				}
				if (result.invalidated_steps?.length) {
					patchSession({
						invalidated_steps: result.invalidated_steps,
						artifacts: result.artifacts,
						pipeline_errors: result.pipeline_errors
					})
				}
				await refreshSession()
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content: 'Circuit re-validated successfully after design update',
					isCompletion: true
				})
				return true
			}
			setPendingFeedback({
				target: 'design',
				message:
					'The circuit was re-validated against the updated design, but there are ' +
					'validation errors that need fixing:\n\n' +
					(result.errors ?? 'Unknown error') +
					'\n\nPlease adjust the design to fix these issues.'
			})
			setActiveStage('design')
			await refreshSession()
			return false
		} catch {
			return false
		}
	}, [currentSession, setCircuit, patchSession, refreshSession, appendMessage, nextId])

	return {
		messages,
		streaming,
		conversationLoading,
		tokenUsage,
		runCircuit,
		sendFeedback,
		loadConversation,
		resetConversation,
		revalidate,
		cancel
	}
}
