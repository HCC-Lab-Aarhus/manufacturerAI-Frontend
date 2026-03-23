import type { ConversationMessage, TokenUsage } from '@/types/models'

import apiClient from './client'
import { type SSECallbacks, consumeSSEStream } from './sse'

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export async function startSetup (
	sessionId: string,
	feedback?: string,
	outline?: string
): Promise<{ status: string; message?: string }> {
	const body: Record<string, string> = {}
	if (feedback) body.feedback = feedback
	if (outline) body.outline = outline
	const { data } = await apiClient.post<{ status: string; message?: string }>(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup`,
		Object.keys(body).length ? body : undefined
	)
	return data
}

export async function stopSetup (sessionId: string): Promise<void> {
	await apiClient.post(`/api/sessions/${encodeURIComponent(sessionId)}/setup/stop`)
}

export function streamSetupEvents (
	sessionId: string,
	callbacks: SSECallbacks,
	after: number = 0
): AbortController {
	return consumeSSEStream(
		`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/setup/stream?after=${after}`,
		{ method: 'GET' },
		callbacks
	)
}

export async function getSetupStatus (sessionId: string): Promise<{
	status: string
	event_count: number
	last_save_cursor: number
	error?: string
}> {
	const { data } = await apiClient.get(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup/status`
	)
	return data as { status: string; event_count: number; last_save_cursor: number; error?: string }
}

export async function getSetupFirmware (sessionId: string): Promise<{ code: string }> {
	const { data } = await apiClient.get<{ code: string }>(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup/firmware`
	)
	return data
}

export async function getSetupConversation (sessionId: string): Promise<ConversationMessage[]> {
	const { data } = await apiClient.get<ConversationMessage[]>(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup/conversation`
	)
	return data
}

export interface SimPeripheral {
	instance_id: string
	type: 'button' | 'led' | 'ir_output'
	port: string
	pin: number
	active_low?: boolean
	pwm?: boolean
	carrier_freq?: number
}

export interface SimConfig {
	mcu: string
	frequency: number
	elf_path: string
	peripherals: SimPeripheral[]
}

export async function getSimConfig (sessionId: string): Promise<SimConfig> {
	const { data } = await apiClient.get<SimConfig>(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup/sim-config`
	)
	return data
}

export async function recompileFirmware (sessionId: string): Promise<{
	status: string
	stderr?: string
	stdout?: string
	hex_path?: string | null
	elf_path?: string | null
}> {
	const { data } = await apiClient.post(
		`/api/sessions/${encodeURIComponent(sessionId)}/setup/recompile`
	)
	return data as {
		status: string
		stderr?: string
		stdout?: string
		hex_path?: string | null
		elf_path?: string | null
	}
}
