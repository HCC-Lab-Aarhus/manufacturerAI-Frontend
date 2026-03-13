import { type MetadataRoute } from 'next'

export default function manifest (): MetadataRoute.Manifest {
	return {
		name: 'ManufacturerAI',
		short_name: 'ManufacturerAI',
		start_url: '/',
		display: 'standalone',
		background_color: '#0a0a0a',
		theme_color: '#0a0a0a',
		icons: [
			{
				src: '/favicon.ico',
				sizes: '48x48',
				type: 'image/x-icon'
			}
		]
	}
}
