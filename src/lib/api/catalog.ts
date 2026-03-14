import type { Catalog, CatalogComponent } from '@/types/models'

import apiClient from './client'

export async function getCatalog (): Promise<Catalog> {
	const { data } = await apiClient.get<Catalog>('/api/v2/catalog')
	return data
}

export async function getComponent (componentId: string): Promise<CatalogComponent> {
	const { data } = await apiClient.get<CatalogComponent>(`/api/v2/catalog/${encodeURIComponent(componentId)}`)
	return data
}

export async function getSessionCatalog (sessionId: string): Promise<Catalog> {
	const { data } = await apiClient.get<Catalog>(`/api/v2/sessions/${encodeURIComponent(sessionId)}/catalog`)
	return data
}
