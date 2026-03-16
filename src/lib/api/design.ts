import type {
	ConversationMessage,
	DesignSpec,
	PipelineError,
	PlacementValidation,
	TokenUsage
} from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export async function startDesign (
	prompt: string,
	sessionId: string
): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design`,
		{ prompt }
	)
	return data
}

export function streamDesignEvents (
	sessionId: string,
	callbacks: SSECallbacks,
	after: number = 0
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/v2/sessions/${encodeURIComponent(sessionId)}/design/stream?after=${after}`,
		{ method: 'GET' },
		callbacks
	)
}

export async function getDesignStatus (sessionId: string): Promise<{ status: string; event_count: number; last_save_cursor: number; error?: string }> {
	const { data } = await apiClient.get(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/status`
	)
	return data as { status: string; event_count: number; last_save_cursor: number; error?: string }
}

export async function stopDesign (sessionId: string): Promise<void> {
	await apiClient.post(`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/stop`)
}

export function streamDesign (
	prompt: string,
	callbacks: SSECallbacks,
	sessionId: string
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/v2/sessions/${encodeURIComponent(sessionId)}/design`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt })
		},
		callbacks
	)
}

export async function getDesignConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/conversation`
	)
	return data
}

export async function getDesignResult (sessionId: string): Promise<DesignSpec> {
	const { data } = await apiClient.get<DesignSpec>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design`
	)
	return data
}

type PutDesignResponse = DesignSpec & {
	invalidated_steps?: string[]
	artifacts?: Record<string, boolean>
	pipeline_errors?: Record<string, PipelineError>
}

export async function putDesign (sessionId: string, design: DesignSpec): Promise<PutDesignResponse> {
	const { data } = await apiClient.put<PutDesignResponse>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design`,
		design
	)
	return data
}

export async function patchEnclosure (
	sessionId: string,
	enclosure: Partial<DesignSpec['enclosure']>
): Promise<DesignSpec> {
	const { data } = await apiClient.patch<DesignSpec>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/enclosure`,
		enclosure
	)
	return data
}

export async function validateUIPlacement (
	sessionId: string,
	placement: { instance_id: string; x_mm: number; y_mm: number; edge_index?: number }
): Promise<PlacementValidation> {
	const { data } = await apiClient.post<PlacementValidation>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/validate-ui-placement`,
		placement
	)
	return data
}

export async function submitDesignToConversation (
	sessionId: string,
	design: DesignSpec
): Promise<void> {
	await apiClient.patch(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/conversation/submit`,
		{ design }
	)
}

export async function getTokenUsage (sessionId: string): Promise<TokenUsage> {
	const { data } = await apiClient.get<TokenUsage>(
		`/api/v2/sessions/${encodeURIComponent(sessionId)}/design/tokens`
	)
	return data
}
