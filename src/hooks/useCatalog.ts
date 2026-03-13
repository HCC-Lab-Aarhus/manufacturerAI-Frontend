'use client'

import { useCallback, useEffect, useState } from 'react'

import { getCatalog } from '@/lib/api'
import type { Catalog, CatalogComponent } from '@/types/models'

export function useCatalog () {
	const [catalog, setCatalog] = useState<Catalog | null>(null)
	const [loading, setLoading] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const data = await getCatalog()
			setCatalog(data)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => { load() }, [load])

	const uiComponents: CatalogComponent[] = catalog?.components.filter(c => c.ui_placement) ?? []
	const internalComponents: CatalogComponent[] = catalog?.components.filter(c => !c.ui_placement) ?? []

	return { catalog, loading, reload: load, uiComponents, internalComponents }
}
