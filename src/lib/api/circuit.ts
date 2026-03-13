import type { CircuitSpec, ConversationMessage } from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export function streamCircuit (
	sessionId: string,
	callbacks: SSECallbacks
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/session/circuit?session=${encodeURIComponent(sessionId)}`,
		{ method: 'POST' },
		callbacks
	)
}

export async function getCircuitConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>('/api/session/circuit/conversation', {
		params: { session: sessionId }
	})
	return data
}

export async function getCircuitResult (sessionId: string): Promise<CircuitSpec> {
	const { data } = await apiClient.get<CircuitSpec>('/api/session/circuit/result', {
		params: { session: sessionId }
	})
	return data
}
