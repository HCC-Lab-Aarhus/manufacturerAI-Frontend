'use client'

import type { ReactElement } from 'react'

import Sidebar from '@/components/layout/Sidebar'
import DesignPanel from '@/components/pipeline/DesignPanel'
import PipelineContent from '@/components/pipeline/PipelineContent'
import PipelineTabs from '@/components/pipeline/PipelineTabs'
import { useSession } from '@/contexts/SessionContext'

export default function Home (): ReactElement {
	const { currentSession } = useSession()

	return (
		<div className="flex h-screen overflow-hidden">
			<Sidebar />

			<main className="flex flex-1 flex-col overflow-hidden">
				{currentSession ? (
					<>
						<PipelineTabs />
						<PipelineContent />
					</>
				) : (
					<DesignPanel />
				)}
			</main>
		</div>
	)
}
