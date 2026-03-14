import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import type { CSSProperties, ReactElement } from 'react'

import ClientProviders from '@/components/ClientProviders'
import { DEFAULT_COLOR, deriveThemeVars, isDarkTheme } from '@/lib/theme'

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

export default async function RootLayout ({
	children
}: Readonly<{
	children: React.ReactNode
}>): Promise<ReactElement> {
	const cookieStore = await cookies()
	const themeColor = cookieStore.get('theme-color')?.value ?? DEFAULT_COLOR
	const themeVars = deriveThemeVars(themeColor)
	const style: CSSProperties = {
		...themeVars as unknown as CSSProperties,
		colorScheme: isDarkTheme(themeColor) ? 'dark' : 'light'
	}

	return (
		<html lang="en" style={style}>
			<body className={`${inter.className} bg-surface text-fg antialiased`}>
				<ClientProviders initialColor={themeColor}>
					{children}
				</ClientProviders>
			</body>
		</html>
	)
}
