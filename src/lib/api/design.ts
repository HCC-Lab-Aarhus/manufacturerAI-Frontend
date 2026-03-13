import type {
	ConversationMessage,
	DesignSpec,
	PlacementValidation,
	TokenUsage
} from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export function streamDesign (
	prompt: string,
	callbacks: SSECallbacks,
	sessionId?: string
): AbortController {
	const params = new URLSearchParams()
	if (sessionId) { params.set('session', sessionId) }

	const qs = params.toString()
	return consumeSSEStream(
		`${baseUrl}/api/session/design${qs ? `?${qs}` : ''}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt })
		},
		callbacks
	)
}

export async function getDesignConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>('/api/session/conversation', {
		params: { session: sessionId }
	})
	return data
}

export async function getDesignResult (sessionId: string): Promise<DesignSpec> {
	const { data } = await apiClient.get<DesignSpec>('/api/session/design/result', {
		params: { session: sessionId }
	})
	return data
}

export async function putDesign (sessionId: string, design: DesignSpec): Promise<DesignSpec> {
	const { data } = await apiClient.put<DesignSpec>('/api/session/design', design, {
		params: { session: sessionId }
	})
	return data
}

export async function patchEnclosure (
	sessionId: string,
	enclosure: Partial<DesignSpec['enclosure']>
): Promise<DesignSpec> {
	const { data } = await apiClient.patch<DesignSpec>('/api/session/design/enclosure', enclosure, {
		params: { session: sessionId }
	})
	return data
}

export async function validateUIPlacement (
	sessionId: string,
	placement: { instance_id: string; x_mm: number; y_mm: number; edge_index?: number }
): Promise<PlacementValidation> {
	const { data } = await apiClient.post<PlacementValidation>(
		'/api/session/design/validate-ui-placement',
		placement,
		{ params: { session: sessionId } }
	)
	return data
}

export async function submitDesignToConversation (
	sessionId: string,
	design: DesignSpec
): Promise<void> {
	await apiClient.patch('/api/session/conversation/submit-design', { design }, {
		params: { session: sessionId }
	})
}

export async function getTokenUsage (sessionId: string): Promise<TokenUsage> {
	const { data } = await apiClient.get<TokenUsage>('/api/session/tokens', {
		params: { session: sessionId }
	})
	return data
}
