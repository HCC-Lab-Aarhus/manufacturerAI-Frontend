import type { RoutingResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function runInflation (sessionId: string): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/sessions/${sid(sessionId)}/manufacture/inflation`
	)
	return data
}

export async function pollInflation (sessionId: string): Promise<{ status: string; message?: string }> {
	const { data } = await apiClient.get(
		`/api/sessions/${sid(sessionId)}/manufacture/inflation/status`
	)
	return data as { status: string; message?: string }
}

export async function getInflationResult (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.get<RoutingResult>(
		`/api/sessions/${sid(sessionId)}/manufacture/inflation`
	)
	return data
}
