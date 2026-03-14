import apiClient from './client'

export interface CalibrationParams {
	printer: string
	filament: string
	bed_width: number
	bed_depth: number
	box_size: number
	padding: number
	square_size: number
}

export interface CalibrationResult {
	gcode: string
	bitmap: string
}

export async function generateCalibration (params: CalibrationParams): Promise<CalibrationResult> {
	const { data } = await apiClient.post<CalibrationResult>(
		'/api/v2/debug/calibrate',
		null,
		{ params: params as unknown as Record<string, string> }
	)
	return data
}
