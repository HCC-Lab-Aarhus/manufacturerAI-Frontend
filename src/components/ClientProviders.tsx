'use client'

import type { ReactElement, ReactNode } from 'react'

import ErrorProvider from '@/contexts/ErrorContext/ErrorProvider'
import { PipelineProvider } from '@/contexts/PipelineContext'
import { SessionProvider } from '@/contexts/SessionContext'

interface ClientProvidersProps {
	children: ReactNode
}

export default function ClientProviders ({ children }: ClientProvidersProps): ReactElement {
	return (
		<ErrorProvider>
			<SessionProvider>
				<PipelineProvider>
					{children}
				</PipelineProvider>
			</SessionProvider>
		</ErrorProvider>
	)
}
