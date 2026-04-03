import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function cancelPipeline (sessionId: string): Promise<{ status: string; cancelled: string[] }> {
	const { data } = await apiClient.post<{ status: string; cancelled: string[] }>(
		`/api/sessions/${sid(sessionId)}/manufacture/pipeline/cancel`
	)
	return data
}
