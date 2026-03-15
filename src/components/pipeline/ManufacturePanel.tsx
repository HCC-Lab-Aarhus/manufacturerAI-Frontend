'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useEffect, useState } from 'react'

import { useSession } from '@/contexts/SessionContext'
import type { StepStatus, ManufactureStepState } from '@/hooks/useManufacture'
import { useManufacture } from '@/hooks/useManufacture'
import { getBundleDownloadUrl, getGCodeDownloadUrl, getBitmapDownloadUrl, getPrintJobDownloadUrl, getStlDownloadUrl } from '@/lib/api'
import { listFilaments } from '@/lib/api'
import type { Filament } from '@/types/models'

const PlacementViewport = dynamic(() => import('@/components/viewport/PlacementViewport'), { ssr: false })
const RoutingViewport = dynamic(() => import('@/components/viewport/RoutingViewport'), { ssr: false })
const BitmapViewport = dynamic(() => import('@/components/viewport/BitmapViewport'), { ssr: false })
const Scene3D = dynamic(() => import('@/components/viewport/Scene3D'), { ssr: false })

const STEP_ICONS: Record<string, string> = {
	placement: 'PLC',
	routing: 'RTE',
	bitmap: 'BMP',
	scad: 'CAD',
	compile: 'CMP',
	gcode: 'GCO'
}

const STATUS_STYLES: Record<StepStatus, string> = {
	pending: 'text-fg-secondary',
	running: 'text-accent',
	done: 'text-success',
	error: 'text-danger',
	skipped: 'text-fg-secondary'
}

const STATUS_BADGE: Record<StepStatus, string> = {
	pending: '○',
	running: '◉',
	done: '✓',
	error: '✗',
	skipped: '–'
}

function StepRow ({ s }: { s: ManufactureStepState }): ReactElement {
	return (
		<div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
			s.status === 'running' ? 'bg-surface-active' : ''
		}`}>
			<span className="text-xs font-mono font-semibold text-fg-secondary w-8">{STEP_ICONS[s.step]}</span>
			<span className={`flex-1 text-sm font-medium ${STATUS_STYLES[s.status]}`}>
				{s.label}
			</span>
			{s.status === 'running' && (
				<span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
			)}
			<span className={`text-sm font-bold ${STATUS_STYLES[s.status]}`}>
				{STATUS_BADGE[s.status]}
			</span>
			{s.message && (
				<span className="text-xs text-fg-secondary">{s.message}</span>
			)}
		</div>
	)
}

type ViewTab = 'steps' | 'placement' | 'routing' | 'bitmap' | '3d'

export default function ManufacturePanel (): ReactElement {
	const { currentSession } = useSession()
	const { steps, running, allDone, placementResult, routingResult, bitmapResult, gcodeStatus, runPipeline, stop } = useManufacture()
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [selectedFilament, setSelectedFilament] = useState<string>('')
	const [silverinkOnly, setSilverinkOnly] = useState(false)
	const [viewTab, setViewTab] = useState<ViewTab>('steps')

	useEffect(() => {
		listFilaments().then(setFilaments).catch(() => {})
	}, [])

	const sessionId = currentSession?.id

	const firstIncomplete = steps.find(s => s.status !== 'done')
	const canResume = !running && firstIncomplete && steps.some(s => s.status === 'done')

	const VIEW_TABS: { key: ViewTab; label: string; enabled: boolean }[] = [
		{ key: 'steps', label: 'Steps', enabled: true },
		{ key: 'placement', label: 'Placement', enabled: !!placementResult },
		{ key: 'routing', label: 'Routing', enabled: !!routingResult },
		{ key: 'bitmap', label: 'Bitmap', enabled: !!bitmapResult },
		{ key: '3d', label: '3D', enabled: !!placementResult }
	]

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-border px-4 py-1.5">
				<div className="flex items-center gap-1">
					{VIEW_TABS.map(t => (
						<button
							key={t.key}
							onClick={() => setViewTab(t.key)}
							disabled={!t.enabled}
							className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
								viewTab === t.key ? 'bg-accent text-white' : 'text-fg-secondary hover:bg-surface-hover'
							} disabled:opacity-30`}
						>
							{t.label}
						</button>
					))}
				</div>
				<div className="flex items-center gap-3">
					{!running && !allDone && (
						<label className="flex items-center gap-1.5 text-xs text-fg-secondary">
							<input
								type="checkbox"
								checked={silverinkOnly}
								onChange={e => setSilverinkOnly(e.target.checked)}
								className="rounded border-border-light"
							/>
							SilverInk only
						</label>
					)}
					{filaments.length > 0 && !running && !allDone && (
						<select
							value={selectedFilament}
							onChange={e => setSelectedFilament(e.target.value)}
							title="Filament"
							className="rounded-lg border border-border bg-surface-card px-2 py-1.5 text-xs text-fg-secondary"
						>
							<option value="">Default filament</option>
							{filaments.map(f => (
								<option key={f.id} value={f.id}>{f.label}</option>
							))}
						</select>
					)}
					{running ? (
						<button
							onClick={stop}
							className="rounded-xl bg-danger px-4 py-1.5 text-sm font-medium text-white hover:bg-danger/80 transition-colors"
						>
							Stop
						</button>
					) : allDone ? (
						<span className="text-sm font-medium text-success">Complete</span>
					) : canResume ? (
						<button
							onClick={() => runPipeline(firstIncomplete!.step, { filament: selectedFilament || undefined, silverink_only: silverinkOnly })}
							className="rounded-xl bg-accent-muted px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
						>
							Resume from {firstIncomplete!.label}
						</button>
					) : (
						<button
							onClick={() => runPipeline(undefined, { filament: selectedFilament || undefined, silverink_only: silverinkOnly })}
							className="rounded-xl bg-accent-muted px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
						>
							Start Manufacturing
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-hidden">
				{viewTab === 'placement' && placementResult ? (
					<PlacementViewport placement={placementResult} className="w-full h-full" />
				) : viewTab === 'routing' && routingResult ? (
					<RoutingViewport routing={routingResult} className="w-full h-full" />
				) : viewTab === 'bitmap' && bitmapResult ? (
					<BitmapViewport bitmap={bitmapResult} className="w-full h-full" />
				) : viewTab === '3d' && placementResult ? (
					<Scene3D
						placement={placementResult}
						routing={routingResult}
						stlUrl={allDone && sessionId ? getStlDownloadUrl(sessionId) : undefined}
						className="w-full h-full"
					/>
				) : (
					<div className="overflow-y-auto p-6 h-full">
						<div className="mx-auto flex max-w-lg flex-col gap-1">
							{steps.map(s => (
								<StepRow key={s.step} s={s} />
							))}
						</div>

						{allDone && sessionId && (
							<div className="mx-auto mt-8 max-w-lg rounded-2xl bg-surface-chip p-6">
								<h3 className="mb-4 text-sm font-semibold text-fg">Output Files</h3>
								<div className="flex flex-col gap-2">
									<a
										href={getGCodeDownloadUrl(sessionId)}
										download
										className="flex items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-sm text-fg hover:bg-surface-hover transition-colors"
									>
										<span className="flex-1 font-medium">enclosure_staged.gcode</span>
										<span className="text-xs text-fg-secondary">PLA + pause markers</span>
									</a>
									{gcodeStatus?.has_bgcode && (
										<a
											href={getGCodeDownloadUrl(sessionId, 'bgcode')}
											download
											className="flex items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-sm text-fg hover:bg-surface-hover transition-colors"
										>
											<span className="flex-1 font-medium">enclosure_staged.bgcode</span>
											<span className="text-xs text-fg-secondary">Binary G-code</span>
										</a>
									)}
									<a
										href={getStlDownloadUrl(sessionId)}
										download
										className="flex items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-sm text-fg hover:bg-surface-hover transition-colors"
									>
										<span className="flex-1 font-medium">enclosure.stl</span>
										<span className="text-xs text-fg-secondary">3D model</span>
									</a>
									<a
										href={getBitmapDownloadUrl(sessionId)}
										download
										className="flex items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-sm text-fg hover:bg-surface-hover transition-colors"
									>
										<span className="flex-1 font-medium">trace_bitmap.txt</span>
										<span className="text-xs text-fg-secondary">Nozzle-native resolution</span>
									</a>
									<a
										href={getPrintJobDownloadUrl(sessionId)}
										download
										className="flex items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-sm text-fg hover:bg-surface-hover transition-colors"
									>
										<span className="flex-1 font-medium">print_job.json</span>
										<span className="text-xs text-fg-secondary">Print manifest</span>
									</a>
									<a
										href={getBundleDownloadUrl(sessionId)}
										download
										className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-success px-6 py-3 text-sm font-semibold text-white hover:bg-success/80 transition-colors"
									>
										Download Bundle (.zip)
									</a>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
