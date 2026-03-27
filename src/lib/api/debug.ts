import apiClient from './client'

export interface DebugParams {
	printer: string
	filament: string
}

export interface CalibrationResult {
	gcode: string
	bitmap: string
	contract: Record<string, unknown>
}

export interface LayersResult {
	gcode: string
	bitmap_1: string
	bitmap_2: string
	bitmap_3: string
	contract: Record<string, unknown>
}

export async function generateCalibration (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/calibrate',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateSilverinkTest (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/silverink-test',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateComponents (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/components',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateLayers (params: DebugParams): Promise<LayersResult> {
	const { data } = await apiClient.post<LayersResult>(
		'/api/debug/layers',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateSpacing (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/spacing',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateChannel (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/channel',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateWidth (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/width',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateSolidSquares (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/solid-squares',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface GenerateAllParams {
	printer: string
	filaments: string
}

export async function generateAllTests (params: GenerateAllParams): Promise<Record<string, string>> {
	const { data } = await apiClient.post<{ files: Record<string, string> }>(
		'/api/debug/generate-all',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data.files
}
