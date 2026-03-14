import type { CircuitSpec, ConversationMessage } from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export function streamCircuit (
	sessionId: string,
	callbacks: SSECallbacks
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/v2/sessions/${encodeURIComponent(sessionId)}/circuit`,
		{ method: 'POST' },
		callbacks
	)
}

export async function getCircuitConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/circuit/conversation`
	)
	return data
}

export async function getCircuitResult (sessionId: string): Promise<CircuitSpec> {
	const { data } = await apiClient.get<CircuitSpec>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/circuit`
	)
	return data
}
