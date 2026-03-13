import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { type ReactElement } from 'react'

import ClientProviders from '@/components/ClientProviders'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: {
		template: '%s | ManufacturerAI',
		default: 'ManufacturerAI'
	},
	description: 'AI-powered hardware design pipeline for 3D-printed electronics with conductive ink traces.',
	applicationName: 'ManufacturerAI',
	icons: {
		icon: '/favicon.ico'
	}
}

export default function RootLayout ({
	children
}: Readonly<{
	children: React.ReactNode
}>): ReactElement {
	return (
		<html lang="en" className="dark">
			<body className={`${inter.className} bg-neutral-950 text-neutral-100 antialiased`}>
				<ClientProviders>
					{children}
				</ClientProviders>
			</body>
		</html>
	)
}
