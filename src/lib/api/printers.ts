import type { Filament, PipelineError, Printer } from '@/types/models'

import apiClient from './client'

export async function listPrinters (): Promise<Printer[]> {
	const { data } = await apiClient.get<{ printers: Printer[] }>('/api/printers')
	return data.printers
}

interface SetPrinterResponse {
	printer_id: string
	label: string
	invalidated_steps: string[]
	artifacts: Record<string, boolean>
	pipeline_errors: Record<string, PipelineError>
}

export async function setSessionPrinter (
	sessionId: string,
	printerId: string
): Promise<SetPrinterResponse> {
	const { data } = await apiClient.put<SetPrinterResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/printer`, null, {
		params: { printer_id: printerId }
	})
	return data
}

interface SetFilamentResponse {
	filament_id: string
	label: string
	invalidated_steps: string[]
	artifacts: Record<string, boolean>
	pipeline_errors: Record<string, PipelineError>
}

export async function setSessionFilament (
	sessionId: string,
	filamentId: string
): Promise<SetFilamentResponse> {
	const { data } = await apiClient.put<SetFilamentResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/filament`, null, {
		params: { filament_id: filamentId }
	})
	return data
}

export async function listFilaments (): Promise<Filament[]> {
	const { data } = await apiClient.get<{ filaments: Filament[] }>('/api/filaments')
	return data.filaments
}
