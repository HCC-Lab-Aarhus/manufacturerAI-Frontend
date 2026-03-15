import type { CompileStatus } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function startCompile (sessionId: string, force = false): Promise<CompileStatus> {
	const { data } = await apiClient.post<CompileStatus>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/compile`,
		null,
		{ params: force ? { force: 'true' } : undefined }
	)
	return data
}

export async function pollCompile (sessionId: string): Promise<CompileStatus> {
	const { data } = await apiClient.get<CompileStatus>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/compile`
	)
	return data
}

export function getStlDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/stl`
}
