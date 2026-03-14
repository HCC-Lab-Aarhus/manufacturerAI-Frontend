'use client'

import type { ReactElement, ReactNode } from 'react'

import ErrorProvider from '@/contexts/ErrorContext/ErrorProvider'
import { PipelineProvider } from '@/contexts/PipelineContext'
import { SessionProvider } from '@/contexts/SessionContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

interface ClientProvidersProps {
	initialColor: string
	children: ReactNode
}

export default function ClientProviders ({ initialColor, children }: ClientProvidersProps): ReactElement {
	return (
		<ThemeProvider initialColor={initialColor}>
			<ErrorProvider>
				<SessionProvider>
					<PipelineProvider>
						{children}
					</PipelineProvider>
				</SessionProvider>
			</ErrorProvider>
		</ThemeProvider>
	)
}
