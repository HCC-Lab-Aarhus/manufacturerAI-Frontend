'use client'

import { type ReactElement, useCallback, useEffect, useState } from 'react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { listFilaments, getGCodeDownloadUrl } from '@/lib/api'
import type { Filament } from '@/types/models'

export default function GCodePanel (): ReactElement {
	const { currentSession } = useSession()
	const { gcodeStatus } = usePipeline()
	const { runningStage, execGCode } = usePipelineActions()
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [selectedFilament, setSelectedFilament] = useState<string>('')
	const [silverinkOnly, setSilverinkOnly] = useState(false)

	const isRunning = runningStage === 'gcode'

	useEffect(() => {
		listFilaments().then(f => {
			setFilaments(f)
			if (f.length > 0 && !selectedFilament) {
				setSelectedFilament(f[0].id)
			}
		}).catch(() => {})
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	const handleGenerate = useCallback(() => {
		execGCode(selectedFilament || undefined, silverinkOnly)
	}, [execGCode, selectedFilament, silverinkOnly])

	if (!currentSession?.pipeline_state.scad) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
				{'Complete the SCAD stage first'}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
				<h2 className="text-sm font-semibold text-neutral-200">{'G-Code Generation'}</h2>
				{isRunning ? (
					<LoadingSpinner size="sm" label="Generating G-code…" />
				) : (
					<button
						onClick={handleGenerate}
						className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
					>
						{gcodeStatus?.status === 'done' ? 'Re-generate' : 'Generate G-Code'}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				<div className="flex flex-wrap items-center gap-4">
					{filaments.length > 0 && (
						<label className="flex items-center gap-2 text-sm text-neutral-300">
							{'Filament'}
							<select
								value={selectedFilament}
								onChange={e => { setSelectedFilament(e.target.value) }}
								className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-200 outline-none"
							>
								{filaments.map(f => (
									<option key={f.id} value={f.id}>{f.label}</option>
								))}
							</select>
						</label>
					)}

					<label className="flex items-center gap-2 text-sm text-neutral-400">
						<input
							type="checkbox"
							checked={silverinkOnly}
							onChange={e => { setSilverinkOnly(e.target.checked) }}
							className="rounded border-neutral-600"
						/>
						{'Silver ink only'}
					</label>
				</div>

				{gcodeStatus && (
					<div className="space-y-3">
						<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
							<div className="flex items-center gap-2 text-sm text-neutral-300">
								<StatusBadge status={gcodeStatus.status} />
								<span>{gcodeStatus.message ?? gcodeStatus.status}</span>
							</div>

							{gcodeStatus.stages && gcodeStatus.stages.length > 0 && (
								<ul className="mt-3 space-y-1">
									{gcodeStatus.stages.map(stage => (
										<li key={stage.name} className="flex items-center gap-2 text-xs text-neutral-400">
											<span className={stage.status === 'done' ? 'text-green-500' : stage.status === 'error' ? 'text-red-500' : 'text-yellow-500'}>
												{stage.status === 'done' ? '✓' : stage.status === 'error' ? '✗' : '…'}
											</span>
											<span>{stage.name}</span>
											{stage.message && <span className="text-neutral-500">{`— ${stage.message}`}</span>}
										</li>
									))}
								</ul>
							)}
						</div>

						{gcodeStatus.status === 'done' && currentSession && (
							<div className="flex flex-wrap gap-2">
								<a
									href={getGCodeDownloadUrl(currentSession.id, 'gcode')}
									download="enclosure.gcode"
									className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
								>
									{'⬇ Download .gcode'}
								</a>
								{gcodeStatus.has_bgcode && (
									<a
										href={getGCodeDownloadUrl(currentSession.id, 'bgcode')}
										download="enclosure.bgcode"
										className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
									>
										{'⬇ Download .bgcode'}
									</a>
								)}
							</div>
						)}
					</div>
				)}

				{!gcodeStatus && (
					<div className="flex h-40 items-center justify-center text-neutral-500 text-sm">
						{'Configure options and generate G-code for manufacturing'}
					</div>
				)}
			</div>
		</div>
	)
}

function StatusBadge ({ status }: { status: string }): ReactElement {
	const styles: Record<string, string> = {
		pending: 'bg-yellow-900/50 text-yellow-400',
		running: 'bg-blue-900/50 text-blue-400',
		done: 'bg-green-900/50 text-green-400',
		error: 'bg-red-900/50 text-red-400'
	}
	return (
		<span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] ?? 'bg-neutral-700 text-neutral-400'}`}>
			{status}
		</span>
	)
}
