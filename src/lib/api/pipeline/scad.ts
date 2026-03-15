import type { ScadResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function generateScad (sessionId: string): Promise<ScadResult> {
	const { data } = await apiClient.post<ScadResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/scad`
	)
	return data
}

export async function getScadResult (sessionId: string): Promise<ScadResult> {
	const { data } = await apiClient.get<ScadResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/scad`
	)
	return data
}
