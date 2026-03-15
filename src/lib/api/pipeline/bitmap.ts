import type { BitmapResult } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function generateBitmap (sessionId: string): Promise<void> {
	await apiClient.post(`/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`)
}

export async function getBitmap (sessionId: string): Promise<BitmapResult> {
	const { data } = await apiClient.get<BitmapResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`
	)
	return data
}

export function getBitmapDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`
}
