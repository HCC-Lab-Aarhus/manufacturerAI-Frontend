import type { PlacementResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function runPlacement (sessionId: string): Promise<PlacementResult> {
	const { data } = await apiClient.post<PlacementResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/placement`
	)
	return data
}

export async function getPlacementResult (sessionId: string): Promise<PlacementResult> {
	const { data } = await apiClient.get<PlacementResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/placement`
	)
	return data
}
