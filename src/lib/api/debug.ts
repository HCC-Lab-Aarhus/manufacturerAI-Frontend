import apiClient from './client'

export interface CalibrationParams {
	printer: string
	filament: string
	box_size: number
	padding: number
	square_size: number
}

export interface SilverinkTestParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export interface CalibrationResult {
	gcode: string
	bitmap: string
	contract: Record<string, unknown>
}

export async function generateCalibration (params: CalibrationParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/calibrate',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateSilverinkTest (params: SilverinkTestParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/silverink-test',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface ComponentsParams {
	printer: string
	filament: string
	padding: number
}

export async function generateComponents (params: ComponentsParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/components',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface LayersParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export interface LayersResult {
	gcode: string
	bitmap_1: string
	bitmap_2: string
	bitmap_3: string
	contract: Record<string, unknown>
}

export async function generateLayers (params: LayersParams): Promise<LayersResult> {
	const { data } = await apiClient.post<LayersResult>(
		'/api/debug/layers',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface SpacingParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export async function generateSpacing (params: SpacingParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/spacing',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface WidthParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export async function generateWidth (params: WidthParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/width',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface SquaresParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export async function generateSquares (params: SquaresParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/debug/squares',
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
