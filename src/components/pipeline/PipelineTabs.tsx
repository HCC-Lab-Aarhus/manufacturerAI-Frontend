'use client'

import type { ReactElement } from 'react'

import { isStageAccessible, useSession } from '@/contexts/SessionContext'
import type { PipelineStage } from '@/types/models'

const STAGES: { id: PipelineStage; label: string; icon: string }[] = [
	{ id: 'design', label: 'Design', icon: '✏️' },
	{ id: 'circuit', label: 'Circuit', icon: '⚡' },
	{ id: 'placement', label: 'Place', icon: '📐' },
	{ id: 'routing', label: 'Route', icon: '🔗' },
	{ id: 'scad', label: 'SCAD', icon: '🧊' },
	{ id: 'gcode', label: 'G-Code', icon: '🖨️' }
]

export default function PipelineTabs (): ReactElement {
	const { activeStage, setActiveStage, currentSession } = useSession()
	const pipelineState = currentSession?.pipeline_state ?? {}

	return (
		<nav className="flex border-b border-neutral-800 bg-neutral-950">
			{STAGES.map(stage => {
				const accessible = isStageAccessible(stage.id, pipelineState)
				const isActive = activeStage === stage.id
				const isComplete = pipelineState[stage.id] === 'complete'

				return (
					<button
						key={stage.id}
						onClick={() => { if (accessible) { setActiveStage(stage.id) } }}
						disabled={!accessible}
						className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
							isActive
								? 'text-blue-400'
								: accessible
									? 'text-neutral-400 hover:text-neutral-200'
									: 'cursor-not-allowed text-neutral-600'
						}`}
					>
						<span className="text-xs">{stage.icon}</span>
						<span>{stage.label}</span>
						{isComplete && (
							<span className="ml-1 text-xs text-green-500">{'✓'}</span>
						)}
						{isActive && (
							<span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
						)}
					</button>
				)
			})}
		</nav>
	)
}
