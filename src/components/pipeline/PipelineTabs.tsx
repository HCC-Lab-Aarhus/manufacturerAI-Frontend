'use client'

import type { ReactElement } from 'react'

import { isStageAccessible, useSession } from '@/contexts/SessionContext'
import type { PipelineStage } from '@/types/models'

const STAGES: { id: PipelineStage; label: string }[] = [
	{ id: 'design', label: 'Design' },
	{ id: 'circuit', label: 'Circuit' },
	{ id: 'manufacture', label: 'Manufacture' },
	{ id: 'guide', label: 'Guide' },
	{ id: 'setup', label: 'Setup' }
]

export default function PipelineTabs (): ReactElement {
	const { activeStage, setActiveStage, currentSession } = useSession()
	const pipelineState = currentSession?.pipeline_state ?? {}

	return (
		<nav className="flex border-b border-border bg-surface-alt">
			{STAGES.map(stage => {
				const accessible = isStageAccessible(stage.id, pipelineState)
				const isActive = activeStage === stage.id
				const status = pipelineState[stage.id]
				const isComplete = status === 'complete'

				return (
					<button
						key={stage.id}
						onClick={() => { if (accessible) { setActiveStage(stage.id) } }}
						disabled={!accessible}
						className={`relative flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium transition-colors ${
							isActive
								? 'text-accent-text'
								: accessible
									? 'text-fg-secondary hover:text-fg'
									: 'cursor-not-allowed text-fg-muted'
						}`}
					>

						<span>{stage.label}</span>
						{isComplete && (
							<span className="ml-1 text-xs text-success">{'✓'}</span>
						)}
						{isActive && (
							<span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
						)}
					</button>
				)
			})}
		</nav>
	)
}
