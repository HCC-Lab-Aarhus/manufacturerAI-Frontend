'use client'

import type { ReactElement } from 'react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { usePipelineActions } from '@/hooks/usePipelineActions'

export default function RoutingPanel (): ReactElement {
	const { currentSession } = useSession()
	const { routing } = usePipeline()
	const { runningStage, execRouting } = usePipelineActions()

	const isRunning = runningStage === 'routing'

	if (!currentSession?.pipeline_state.placement) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
				{'Complete the Placement stage first'}
			</div>
		)
	}

	const failedNets = routing?.traces.filter(t => t.path.length === 0) ?? []
	const successNets = routing?.traces.filter(t => t.path.length > 0) ?? []

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'Trace Routing'}</h2>
				{isRunning ? (
					<LoadingSpinner size="sm" label="Routing traces…" />
				) : (
					<button
						onClick={execRouting}
						className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
					>
						{routing ? 'Re-run Routing' : 'Run Router'}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{routing ? (
					<div className="space-y-4">
						{failedNets.length > 0 && (
							<div className="rounded-lg border border-red-800 bg-red-950/30 p-3">
								<p className="text-sm font-medium text-red-400">
									{`${failedNets.length} net(s) failed to route`}
								</p>
								<ul className="mt-1 text-xs text-red-300">
									{failedNets.map(n => (
										<li key={n.net_id}>{n.net_id}</li>
									))}
								</ul>
							</div>
						)}

						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-neutral-800 text-left text-neutral-400">
										<th className="px-3 py-2 font-medium">{'Net'}</th>
										<th className="px-3 py-2 font-medium">{'Points'}</th>
										<th className="px-3 py-2 font-medium">{'Status'}</th>
									</tr>
								</thead>
								<tbody>
									{successNets.map(trace => (
										<tr key={trace.net_id} className="border-b border-neutral-800/50 last:border-0">
											<td className="px-3 py-2 text-neutral-200">{trace.net_id}</td>
											<td className="px-3 py-2 text-neutral-400">{trace.path.length}</td>
											<td className="px-3 py-2">
												<span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
													{'routed'}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<p className="text-xs text-neutral-500">
							{`Trace width: ${routing.trace_width_mm} mm`}
						</p>
					</div>
				) : (
					<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
						{'Run the router to generate conductive ink traces'}
					</div>
				)}
			</div>
		</div>
	)
}
