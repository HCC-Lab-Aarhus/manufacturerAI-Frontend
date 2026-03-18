'use client'

import { useCallback, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { useSession } from '@/contexts/SessionContext'
import {
	startSetup,
	streamSetupEvents,
	getSetupStatus,
	getSetupConversation,
	getSetupFirmware
} from '@/lib/api'
import type { SSEEventType } from '@/types/events'
import type { TokenUsage } from '@/types/models'

import type { ChatEntry } from './useDesignAgent'

export function useSetupAgent () {
	const { currentSession, refreshSession } = useSession()
	const { addError } = useError()

	const [messages, setMessages] = useState<ChatEntry[]>([])
	const [streaming, setStreaming] = useState(false)
	const [conversationLoading, setConversationLoading] = useState(false)
	const [firmwareCode, setFirmwareCode] = useState<string | null>(null)
	const [compiled, setCompiled] = useState(false)
	const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
	const loadedSessionRef = useRef<string | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const streamingRef = useRef(false)
	const firmwareReceivedRef = useRef(false)
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
			case 'firmware': {
				firmwareReceivedRef.current = true
				const fw = d.firmware as Record<string, unknown> | undefined
				setCompiled(!!fw?.compiled)
				break
			}
			case 'error': {
				const msg = String(d.message ?? d)
				if (msg !== 'Cancelled') addError(msg)
				break
			}
			case 'token_usage':
				setTokenUsage(d as unknown as TokenUsage)
				break
			case 'done': {
				const content = firmwareReceivedRef.current
					? 'Firmware generated and saved'
					: 'Setup agent finished'
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content,
					isCompletion: true
				})
				break
			}
		}
	}, [appendMessage, updateLastAssistant, updateLastThinking, addError, nextId])

	const subscribeToStream = useCallback((sessionId: string, after: number = 0) => {
		abortRef.current?.abort()
		eventCursor.current = after
		abortRef.current = streamSetupEvents(
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
					// Fetch the generated firmware once streaming is done
					getSetupFirmware(sessionId)
						.then(fw => { if (fw?.code) setFirmwareCode(fw.code) })
						.catch(() => {})
				}
			},
			after
		)
	}, [handleEvent, addError, refreshSession])

	const runSetup = useCallback(async () => {
		if (!currentSession || streaming) return
		setMessages([])
		setFirmwareCode(null)
		setCompiled(false)
		setStreaming(true)
		streamingRef.current = true
		firmwareReceivedRef.current = false
		try {
			const result = await startSetup(currentSession.id)
			if (result.status === 'skipped') {
				appendMessage({
					id: nextId('status'),
					role: 'status',
					content: result.message ?? 'No MCU in circuit — firmware not needed'
				})
				streamingRef.current = false
				setStreaming(false)
				return
			}
			subscribeToStream(currentSession.id, 0)
		} catch (err) {
			addError(err)
			streamingRef.current = false
			setStreaming(false)
		}
	}, [streaming, currentSession, appendMessage, nextId, subscribeToStream, addError])

	const loadConversation = useCallback(async (sessionId: string) => {
		if (streamingRef.current) {
			loadedSessionRef.current = sessionId
			return
		}
		setConversationLoading(true)
		try {
			const status = await getSetupStatus(sessionId).catch(() => null)
			const isRunning = status?.status === 'running'

			if (isRunning) {
				await new Promise(resolve => setTimeout(resolve, 150))
			}

			const [convo, firmware, freshStatus] = await Promise.all([
				getSetupConversation(sessionId),
				getSetupFirmware(sessionId).catch(() => null),
				isRunning ? getSetupStatus(sessionId).catch(() => null) : Promise.resolve(null)
			])

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

			if (firmware?.code) {
				setFirmwareCode(firmware.code)
				setCompiled(true)
			}

			if (!isRunning && entries.length > 0 && firmware?.code) {
				entries.push({
					id: 'l-status-done',
					role: 'status',
					content: 'Firmware generated and saved',
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
	}, [subscribeToStream])

	const _conversationLoading = conversationLoading || (currentSession?.id != null && loadedSessionRef.current !== currentSession.id)

	const resetConversation = useCallback(() => {
		abortRef.current?.abort()
		streamingRef.current = false
		setStreaming(false)
		setMessages([])
		setFirmwareCode(null)
		setCompiled(false)
		setTokenUsage(null)
		loadedSessionRef.current = null
	}, [])

	return {
		messages,
		streaming,
		conversationLoading: _conversationLoading,
		firmwareCode,
		compiled,
		tokenUsage,
		runSetup,
		loadConversation,
		resetConversation
	}
}
