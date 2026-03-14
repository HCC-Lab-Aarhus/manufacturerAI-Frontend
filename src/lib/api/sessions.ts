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
