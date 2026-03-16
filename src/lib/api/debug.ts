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
