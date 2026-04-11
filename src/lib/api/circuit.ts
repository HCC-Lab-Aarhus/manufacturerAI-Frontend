import type { CircuitSpec, ConversationMessage, PipelineError, TokenUsage } from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export async function startCircuit (
	sessionId: string,
	feedback?: string,
	outline?: string
): Promise<{ status: string }> {
	const body: Record<string, string> = {}
	if (feedback) body.feedback = feedback
	if (outline) body.outline = outline
	const { data } = await apiClient.post<{ status: string }>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit`,
		Object.keys(body).length ? body : undefined
	)
	return data
}

export function streamCircuitEvents (
	sessionId: string,
	callbacks: SSECallbacks,
	after: number = 0
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/circuit/stream?after=${after}`,
		{ method: 'GET' },
		callbacks
	)
}

export async function getCircuitStatus (sessionId: string): Promise<{ status: string; event_count: number; last_save_cursor: number; error?: string }> {
	const { data } = await apiClient.get(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit/status`
	)
	return data as { status: string; event_count: number; last_save_cursor: number; error?: string }
}

export async function stopCircuit (sessionId: string): Promise<void> {
	await apiClient.post(`/api/sessions/${encodeURIComponent(sessionId)}/circuit/stop`)
}

export function streamCircuit (
	sessionId: string,
	callbacks: SSECallbacks,
	feedback?: string,
	outline?: string
): AbortController {
	const init: RequestInit = { method: 'POST' }
	if (feedback || outline) {
		init.headers = { 'Content-Type': 'application/json' }
		init.body = JSON.stringify({
			...(feedback ? { feedback } : {}),
			...(outline ? { outline } : {})
		})
	}
	return consumeSSEStream(
		`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/circuit`,
		init,
		callbacks
	)
}

export async function getCircuitConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit/conversation`
	)
	return data
}

export async function getCircuitResult (sessionId: string): Promise<CircuitSpec> {
	const { data } = await apiClient.get<CircuitSpec>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit`
	)
	return data
}

export async function getCircuitTokenUsage (sessionId: string): Promise<TokenUsage> {
	const { data } = await apiClient.get<TokenUsage>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit/tokens`
	)
	return data
}

export interface RevalidateResult {
	valid: boolean
	errors?: string
	circuit?: CircuitSpec
	invalidated_steps?: string[]
	artifacts?: Record<string, boolean>
	pipeline_errors?: Record<string, PipelineError>
}

export async function revalidateCircuit (sessionId: string): Promise<RevalidateResult> {
	const { data } = await apiClient.post<RevalidateResult>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit/revalidate`
	)
	return data
}

export async function replayCircuit (sessionId: string): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/sessions/${encodeURIComponent(sessionId)}/circuit/replay`
	)
	return data
}
