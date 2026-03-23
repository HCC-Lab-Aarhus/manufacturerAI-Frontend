import type { PlacementResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function runPlacement (sessionId: string): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/sessions/${sid(sessionId)}/manufacture/placement`
	)
	return data
}

export async function pollPlacement (sessionId: string): Promise<{ status: string; message?: string; detail?: Record<string, unknown> }> {
	const { data } = await apiClient.get(
		`/api/sessions/${sid(sessionId)}/manufacture/placement/status`
	)
	return data as { status: string; message?: string; detail?: Record<string, unknown> }
}

export async function getPlacementResult (sessionId: string): Promise<PlacementResult> {
	const { data } = await apiClient.get<PlacementResult>(
		`/api/sessions/${sid(sessionId)}/manufacture/placement`
	)
	return data
}
