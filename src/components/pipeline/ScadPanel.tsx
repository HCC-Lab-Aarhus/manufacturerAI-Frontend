'use client'

import type { ReactElement } from 'react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { getStlDownloadUrl } from '@/lib/api'

export default function ScadPanel (): ReactElement {
	const { currentSession } = useSession()
	const { compileStatus } = usePipeline()
	const { runningStage, execScad } = usePipelineActions()

	const isRunning = runningStage === 'scad'

	if (!currentSession?.pipeline_state.routing) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
				{'Complete the Routing stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'Enclosure (SCAD → STL)'}</h2>
				{isRunning ? (
					<LoadingSpinner size="sm" label="Compiling…" />
				) : (
					<button
						onClick={execScad}
						className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
					>
						{compileStatus?.status === 'done' ? 'Re-generate' : 'Generate Enclosure'}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{compileStatus ? (
					<div className="space-y-4">
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
							<div className="flex items-center gap-2">
								<StatusBadge status={compileStatus.status} />
								<span className="text-sm text-neutral-300">{compileStatus.message ?? compileStatus.status}</span>
							</div>

							{compileStatus.stl_bytes != null && (
								<p className="mt-2 text-xs text-neutral-500">
									{`STL size: ${(compileStatus.stl_bytes / 1024).toFixed(1)} KB`}
								</p>
							)}
						</div>

						{compileStatus.status === 'done' && currentSession && (
							<a
								href={getStlDownloadUrl(currentSession.id)}
								download="enclosure.stl"
								className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
							>
								{'⬇ Download STL'}
							</a>
						)}
					</div>
				) : (
					<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
						{'Generate the OpenSCAD enclosure and compile to STL'}
					</div>
				)}
			</div>
		</div>
	)
}

function StatusBadge ({ status }: { status: string }): ReactElement {
	const styles: Record<string, string> = {
		pending: 'bg-yellow-900/50 text-yellow-400',
		compiling: 'bg-blue-900/50 text-blue-400',
		done: 'bg-green-900/50 text-green-400',
		error: 'bg-red-900/50 text-red-400'
	}
	return (
		<span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] ?? 'bg-neutral-700 text-neutral-400'}`}>
			{status}
		</span>
	)
}
