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
		'/api/v2/debug/calibrate',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export async function generateSilverinkTest (params: SilverinkTestParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/v2/debug/silverink-test',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface CubeTraceParams {
	printer: string
	filament: string
	padding: number
}

export async function generateCubeTrace (params: CubeTraceParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/v2/debug/cube-trace',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface ProgressiveTraceParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export interface ProgressiveTraceResult {
	gcode: string
	bitmap_1: string
	bitmap_2: string
	bitmap_3: string
	contract: Record<string, unknown>
}

export async function generateProgressiveTrace (params: ProgressiveTraceParams): Promise<ProgressiveTraceResult> {
	const { data } = await apiClient.post<ProgressiveTraceResult>(
		'/api/v2/debug/progressive-trace',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface ParallelLinesParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export async function generateParallelLines (params: ParallelLinesParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/v2/debug/parallel-lines',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}

export interface TraceWidthParams {
	printer: string
	filament: string
	padding: number
	rect_width: number
	rect_height: number
	layers: number
}

export async function generateTraceWidth (params: TraceWidthParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/v2/debug/trace-width',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}
