import type {
	BitmapResult,
	CompileStatus,
	GCodeStatus,
	PlacementResult,
	RoutingResult,
	ScadResult
} from '@/types/models'

import apiClient from './client'

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

export async function runRouting (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.post<RoutingResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}

export async function getRoutingResult (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.get<RoutingResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/routing`
	)
	return data
}

export async function generateBitmap (sessionId: string): Promise<void> {
	await apiClient.post(`/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`)
}

export async function getBitmap (sessionId: string): Promise<BitmapResult> {
	const { data } = await apiClient.get<BitmapResult>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`
	)
	return data
}

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

export async function startGCode (
	sessionId: string,
	options?: { force?: boolean; filament?: string; silverink_only?: boolean }
): Promise<void> {
	await apiClient.post(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/gcode`,
		null,
		{
			params: {
				...(options?.force ? { force: 'true' } : {}),
				...(options?.filament ? { filament: options.filament } : {}),
				...(options?.silverink_only ? { silverink_only: 'true' } : {})
			}
		}
	)
}

export async function pollGCode (sessionId: string): Promise<GCodeStatus> {
	const { data } = await apiClient.get<GCodeStatus>(
		`/api/v2/sessions/${sid(sessionId)}/manufacture/gcode`
	)
	return data
}

export function getGCodeDownloadUrl (sessionId: string, format: 'gcode' | 'bgcode' = 'gcode'): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/gcode/download?format=${format}`
}

export function getBundleDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/bundle`
}

export function getBitmapDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/bitmap`
}

export function getPrintJobDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/print-job`
}
