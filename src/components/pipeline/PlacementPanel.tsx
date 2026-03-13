'use client'

import type { ReactElement } from 'react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { usePipelineActions } from '@/hooks/usePipelineActions'

export default function PlacementPanel (): ReactElement {
	const { currentSession } = useSession()
	const { placement } = usePipeline()
	const { runningStage, execPlacement } = usePipelineActions()

	const isRunning = runningStage === 'placement'

	if (!currentSession?.pipeline_state.circuit) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
				{'Complete the Circuit stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'Component Placement'}</h2>
				{isRunning ? (
					<LoadingSpinner size="sm" label="Placing components…" />
				) : (
					<button
						onClick={execPlacement}
						className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
					>
						{placement ? 'Re-run Placement' : 'Run Placement'}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{placement ? (
					<div className="space-y-4">
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-neutral-800 text-left text-neutral-400">
										<th className="px-3 py-2 font-medium">{'Component'}</th>
										<th className="px-3 py-2 font-medium">{'Catalog ID'}</th>
										<th className="px-3 py-2 font-medium">{'Position'}</th>
										<th className="px-3 py-2 font-medium">{'Pins'}</th>
									</tr>
								</thead>
								<tbody>
									{placement.components.map(comp => (
										<tr key={comp.instance_id} className="border-b border-neutral-800/50 last:border-0">
											<td className="px-3 py-2 text-neutral-200">{comp.instance_id}</td>
											<td className="px-3 py-2 text-neutral-400">{comp.catalog_id}</td>
											<td className="px-3 py-2 text-neutral-400">
												{`(${comp.x.toFixed(1)}, ${comp.y.toFixed(1)})`}
											</td>
											<td className="px-3 py-2 text-neutral-400">
												{Object.keys(comp.pin_positions).length}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
						{'Run placement to position components inside the enclosure'}
					</div>
				)}
			</div>
		</div>
	)
}
