import apiClient from './client'

export interface DebugParams {
	printer: string
	filament: string
}

export interface SurfaceTestParams {
	printer: string
}

export interface CalibrationResult {
	gcode: string
	bitmap: string
	contract: Record<string, unknown>
}

export interface SurfaceTestResult {
	bitmap: string
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

export async function generateCombined (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/combined',
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

export async function generateSpacing (params: DebugParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/spacing',
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

export async function generateSurfaceTest (params: SurfaceTestParams): Promise<SurfaceTestResult> {
	const { data } = await apiClient.post<SurfaceTestResult>(
		'/api/debug/surface-test',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface GenerateAllParams {
	printer: string
	filaments?: string
}

export async function generateAllTests (params: GenerateAllParams): Promise<Record<string, string>> {
	const { data } = await apiClient.post<{ files: Record<string, string> }>(
		'/api/debug/generate-all',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data.files
}
