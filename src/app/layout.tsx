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
		<html lang="en">
			<body className={`${inter.className} bg-[#f8f7f4] text-stone-700 antialiased`}>
				<ClientProviders>
					{children}
				</ClientProviders>
			</body>
		</html>
	)
}
