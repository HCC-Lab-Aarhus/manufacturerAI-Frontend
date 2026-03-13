import type { Filament, Printer } from '@/types/models'

import apiClient from './client'

export async function listPrinters (): Promise<Printer[]> {
	const { data } = await apiClient.get<{ printers: Printer[] }>('/api/printers')
	return data.printers
}

export async function setSessionPrinter (
	sessionId: string,
	printerId: string
): Promise<{ printer_id: string; label: string }> {
	const { data } = await apiClient.put('/api/session/printer', null, {
		params: { session: sessionId, printer_id: printerId }
	})
	return data
}

export async function listFilaments (): Promise<Filament[]> {
	const { data } = await apiClient.get<{ filaments: Filament[] }>('/api/filaments')
	return data.filaments
}
