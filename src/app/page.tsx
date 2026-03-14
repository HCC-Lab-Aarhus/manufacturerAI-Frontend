'use client'

import type { ReactElement } from 'react'

import Sidebar from '@/components/layout/Sidebar'
import PipelineContent from '@/components/pipeline/PipelineContent'
import PipelineTabs from '@/components/pipeline/PipelineTabs'

export default function Home (): ReactElement {
	return (
		<div className="flex h-screen overflow-hidden">
			<Sidebar />

			<main className="flex flex-1 flex-col overflow-hidden">
				<PipelineTabs />
				<PipelineContent />
			</main>
		</div>
	)
}
