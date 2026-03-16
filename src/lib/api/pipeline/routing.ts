import type { RoutingResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function runRouting (sessionId: string): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}

export async function pollRouting (sessionId: string): Promise<{ status: string; message?: string; detail?: Record<string, unknown> }> {
	const { data } = await apiClient.get(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing/status`
	)
	return data as { status: string; message?: string; detail?: Record<string, unknown> }
}

export async function getRoutingResult (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.get<RoutingResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}
