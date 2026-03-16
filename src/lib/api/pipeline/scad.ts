import type { ScadResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function generateScad (sessionId: string): Promise<{ status: string }> {
	const { data } = await apiClient.post<{ status: string }>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/scad`
	)
	return data
}

export async function pollScad (sessionId: string): Promise<{ status: string; message?: string; detail?: Record<string, unknown> }> {
	const { data } = await apiClient.get(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/scad/status`
	)
	return data as { status: string; message?: string; detail?: Record<string, unknown> }
}

export async function getScadResult (sessionId: string): Promise<ScadResult> {
	const { data } = await apiClient.get<ScadResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/scad`
	)
	return data
}
