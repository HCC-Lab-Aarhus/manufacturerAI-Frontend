import type { GCodeStatus } from '@/types/models'
import apiClient from '../client'

const sid = (id: string) => encodeURIComponent(id)

export async function startGCode (
	sessionId: string,
	options: { force?: boolean; filament: string; silverink_only?: boolean }
): Promise<void> {
	await apiClient.post(
		`/api/sessions/${sid(sessionId)}/manufacture/gcode`,
		null,
		{
			params: {
				...(options.force ? { force: 'true' } : {}),
				filament: options.filament,
				...(options.silverink_only ? { silverink_only: 'true' } : {})
			}
		}
	)
}

export async function pollGCode (sessionId: string): Promise<GCodeStatus> {
	const { data } = await apiClient.get<GCodeStatus>(
		`/api/sessions/${sid(sessionId)}/manufacture/gcode`
	)
	return data
}

export function getGCodeDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/sessions/${sid(sessionId)}/manufacture/gcode/download`
}
