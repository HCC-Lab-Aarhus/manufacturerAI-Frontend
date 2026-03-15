'use client'

import { useCallback, useRef, useState } from 'react'

import { useError } from '@/contexts/ErrorContext/ErrorContext'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { streamCircuit, getCircuitConversation, getCircuitResult } from '@/lib/api'
import type { SSEEventType } from '@/types/events'
import type { CircuitSpec } from '@/types/models'

import type { ChatEntry } from './useDesignAgent'

export function useCircuitAgent () {
	const { currentSession, refreshSession } = useSession()
	const { setCircuit } = usePipeline()
	const { addError } = useError()

	const [messages, setMessages] = useState<ChatEntry[]>([])
	const [streaming, setStreaming] = useState(false)
	const abortRef = useRef<AbortController | null>(null)
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

	const runCircuit = useCallback(async () => {
		if (!currentSession || streaming) { return }

		setMessages([])
		setCircuit(null)
		setStreaming(true)

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
				case 'circuit':
					setCircuit(d as unknown as CircuitSpec)
					break
				case 'error':
					addError(d.message ?? d)
					break
				case 'done':
					break
			}
		}

		abortRef.current = streamCircuit(
			currentSession.id,
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
			}
		)
	}, [streaming, currentSession, appendMessage, updateLastAssistant, updateLastThinking, setCircuit, refreshSession, addError, nextId])

	const loadConversation = useCallback(async (sessionId: string) => {
		try {
			const [convo, circuit] = await Promise.all([
				getCircuitConversation(sessionId),
				getCircuitResult(sessionId).catch(() => null)
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
						}
					}
				}
			}
			setMessages(entries)

			if (circuit) {
				setCircuit(circuit)
			}
		} catch {
			setMessages([])
		}
	}, [setCircuit])

	const cancel = useCallback(() => {
		abortRef.current?.abort()
		setStreaming(false)
	}, [])

	return {
		messages,
		streaming,
		runCircuit,
		loadConversation,
		cancel
	}
}
