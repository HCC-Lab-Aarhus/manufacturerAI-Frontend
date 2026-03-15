import type { RoutingResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function runRouting (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.post<RoutingResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}

export async function getRoutingResult (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.get<RoutingResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}
