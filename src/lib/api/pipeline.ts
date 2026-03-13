import type {
	BitmapResult,
	CompileStatus,
	GCodeStatus,
	PlacementResult,
	RoutingResult,
	ScadResult
} from '@/types/models'

import apiClient from './client'

export async function runPlacement (sessionId: string): Promise<PlacementResult> {
	const { data } = await apiClient.post<PlacementResult>('/api/session/placement', null, {
		params: { session: sessionId }
	})
	return data
}

export async function getPlacementResult (sessionId: string): Promise<PlacementResult> {
	const { data } = await apiClient.get<PlacementResult>('/api/session/placement/result', {
		params: { session: sessionId }
	})
	return data
}

export async function runRouting (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.post<RoutingResult>('/api/session/routing', null, {
		params: { session: sessionId }
	})
	return data
}

export async function getRoutingResult (sessionId: string): Promise<RoutingResult> {
	const { data } = await apiClient.get<RoutingResult>('/api/session/routing/result', {
		params: { session: sessionId }
	})
	return data
}

export async function generateBitmap (sessionId: string): Promise<void> {
	await apiClient.post('/api/session/bitmap/generate', null, {
		params: { session: sessionId }
	})
}

export async function getBitmap (sessionId: string): Promise<BitmapResult> {
	const { data } = await apiClient.get<BitmapResult>('/api/session/bitmap', {
		params: { session: sessionId }
	})
	return data
}

export async function generateScad (sessionId: string): Promise<ScadResult> {
	const { data } = await apiClient.post<ScadResult>('/api/session/scad', null, {
		params: { session: sessionId }
	})
	return data
}

export async function getScadResult (sessionId: string): Promise<ScadResult> {
	const { data } = await apiClient.get<ScadResult>('/api/session/scad/result', {
		params: { session: sessionId }
	})
	return data
}

export async function startCompile (sessionId: string, force = false): Promise<CompileStatus> {
	const { data } = await apiClient.post<CompileStatus>('/api/session/scad/compile', null, {
		params: { session: sessionId, ...(force ? { force: 'true' } : {}) }
	})
	return data
}

export async function pollCompile (sessionId: string): Promise<CompileStatus> {
	const { data } = await apiClient.get<CompileStatus>('/api/session/scad/compile', {
		params: { session: sessionId }
	})
	return data
}

export function getStlDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/session/scad/stl?session=${encodeURIComponent(sessionId)}`
}

export async function startGCode (
	sessionId: string,
	options?: { force?: boolean; filament?: string; silverink_only?: boolean }
): Promise<void> {
	await apiClient.post('/api/session/gcode', null, {
		params: {
			session: sessionId,
			...(options?.force ? { force: 'true' } : {}),
			...(options?.filament ? { filament: options.filament } : {}),
			...(options?.silverink_only ? { silverink_only: 'true' } : {})
		}
	})
}

export async function pollGCode (sessionId: string): Promise<GCodeStatus> {
	const { data } = await apiClient.get<GCodeStatus>('/api/session/gcode', {
		params: { session: sessionId }
	})
	return data
}

export function getGCodeDownloadUrl (sessionId: string, format: 'gcode' | 'bgcode' = 'gcode'): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/session/gcode/download?session=${encodeURIComponent(sessionId)}&format=${format}`
}
