import type { SessionMeta } from '@/types/models'

import apiClient from './client'

export async function listSessions (): Promise<SessionMeta[]> {
	const { data } = await apiClient.get<{ sessions: SessionMeta[] }>('/api/v2/sessions')
	return data.sessions
}

export async function createSession (description?: string): Promise<{ session_id: string; created: string }> {
	const { data } = await apiClient.post('/api/v2/sessions', null, {
		params: description ? { description } : undefined
	})
	return data
}

export async function getSession (sessionId: string): Promise<SessionMeta> {
	const { data } = await apiClient.get<SessionMeta>(`/api/v2/sessions/${encodeURIComponent(sessionId)}`)
	return data
}

export async function renameSession (sessionId: string, name: string): Promise<{ id: string; name: string }> {
	const { data } = await apiClient.patch(`/api/v2/sessions/${encodeURIComponent(sessionId)}`, { name })
	return data
}

export async function deleteSession (sessionId: string): Promise<void> {
	await apiClient.delete(`/api/v2/sessions/${encodeURIComponent(sessionId)}`)
}
