'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import { useSession } from '@/contexts/SessionContext'
import { usePipeline } from '@/contexts/PipelineContext'
import type { StepStatus, ManufactureStepState } from '@/hooks/useManufacture'
import { useManufacture } from '@/hooks/useManufacture'
import { getBundleDownloadUrl, getGCodeDownloadUrl, getBitmapDownloadUrl, getPrintJobDownloadUrl, getStlDownloadUrl } from '@/lib/api'
import { listFilaments } from '@/lib/api'
import type { Filament } from '@/types/models'

const PlacementViewport = dynamic(() => import('@/components/viewport/PlacementViewport'), { ssr: false })
const RoutingViewport = dynamic(() => import('@/components/viewport/RoutingViewport'), { ssr: false })
const BitmapViewport = dynamic(() => import('@/components/viewport/BitmapViewport'), { ssr: false })
const Scene3D = dynamic(() => import('@/components/viewport/Scene3D'), { ssr: false })

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

const STEP_ICONS: Record<string, string> = {
	placement: 'PLC',
	routing: 'RTE',
	bitmap: 'BMP',
	scad: 'CAD',
	compile: 'CMP',
	gcode: 'GCO'
}

function StepRow ({ s, onInform }: { s: ManufactureStepState; onInform?: (agent: 'design' | 'circuit', message: string) => void }): ReactElement {
	return (
		<div className={`flex flex-col gap-1 px-3 py-1.5 rounded-lg transition-colors ${
			s.status === 'running' ? 'bg-surface-active' : ''
		}`}>
			<div className="flex items-center gap-2.5">
				<span className="text-[10px] font-mono font-semibold text-fg-secondary w-7">{STEP_ICONS[s.step]}</span>
				<span className={`flex-1 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
					{s.label}
				</span>
				{s.status === 'running' && (
					<span className="size-2.5 animate-spin rounded-full border-[1.5px] border-accent border-t-transparent" />
				)}
				<span className={`text-xs font-bold ${STATUS_STYLES[s.status]}`}>
					{STATUS_BADGE[s.status]}
				</span>
			</div>
			{s.status === 'error' && s.message && (
				<div className="ml-9 mt-0.5 flex flex-col gap-1.5">
					<p className="text-[11px] text-danger leading-relaxed">{s.message}</p>
					{s.responsibleAgent && onInform && (
						<button
							onClick={() => onInform(s.responsibleAgent!, s.message!)}
							className="self-start rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition-colors"
						>
							{s.responsibleAgent === 'design' ? 'Inform the Designer' : 'Inform the Circuit'}
						</button>
					)}
				</div>
			)}
			{s.status !== 'error' && s.message && (
				<span className="ml-9 text-[11px] text-fg-secondary">{s.message}</span>
			)}
		</div>
	)
}

type ViewTab = 'placement' | 'routing' | 'bitmap' | '3d'

const STEP_TO_TAB: Record<string, ViewTab> = {
	placement: 'placement',
	routing: 'routing',
	bitmap: 'bitmap',
	scad: '3d',
	compile: '3d',
}

export default function ManufacturePanel (): ReactElement {
	const { currentSession, setActiveStage } = useSession()
	const { setPendingFeedback } = usePipeline()
	const { steps, running, allDone, placementResult, routingResult, bitmapResult, gcodeStatus, runPipeline, stop } = useManufacture()
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [selectedFilament, setSelectedFilament] = useState<string>('')
	const [silverinkOnly, setSilverinkOnly] = useState(false)
	const [viewTab, setViewTab] = useState<ViewTab>('placement')
	const prevDoneRef = useRef<Set<string>>(new Set(steps.filter(s => s.status === 'done').map(s => s.step)))

	useEffect(() => {
		listFilaments().then(setFilaments).catch(() => {})
	}, [])

	useEffect(() => {
		const nowDone = new Set(steps.filter(s => s.status === 'done').map(s => s.step))
		for (const step of nowDone) {
			if (!prevDoneRef.current.has(step) && step in STEP_TO_TAB) {
				setViewTab(STEP_TO_TAB[step])
			}
		}
		prevDoneRef.current = nowDone
	}, [steps])

	const sessionId = currentSession?.id

	const firstIncomplete = steps.find(s => s.status !== 'done')
	const canResume = !running && firstIncomplete && steps.some(s => s.status === 'done')

	const handleInform = useCallback((agent: 'design' | 'circuit', message: string) => {
		const stepLabel = steps.find(s => s.status === 'error')?.label ?? 'a manufacturing step'
		setPendingFeedback({
			target: agent,
			message: `The manufacturing pipeline failed at "${stepLabel}" with the following error:\n\n${message}\n\nPlease fix the issue in your design and resubmit.`
		})
		setActiveStage(agent === 'design' ? 'design' : 'circuit')
	}, [steps, setPendingFeedback, setActiveStage])

	const VIEW_TABS: { key: ViewTab; label: string; enabled: boolean }[] = [
		{ key: 'placement', label: 'Placement', enabled: !!placementResult },
		{ key: 'routing', label: 'Routing', enabled: !!routingResult },
		{ key: 'bitmap', label: 'Bitmap', enabled: !!bitmapResult },
		{ key: '3d', label: '3D', enabled: !!placementResult }
	]

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 flex overflow-hidden">
				{/* Left: Steps panel */}
				<div className="w-72 shrink-0 flex flex-col border-r border-border">
					<div className="flex items-center justify-between px-3 py-2 border-b border-border">
						<span className="text-xs font-semibold text-fg">Steps</span>
						<div className="flex items-center gap-2">
							{!running && !allDone && (
								<label className="flex items-center gap-1 text-[11px] text-fg-secondary">
									<input
										type="checkbox"
										checked={silverinkOnly}
										onChange={e => setSilverinkOnly(e.target.checked)}
										className="rounded border-border-light"
									/>
									SilverInk
								</label>
							)}
							{running ? (
								<button
									onClick={stop}
									className="rounded-md bg-danger px-2.5 py-1 text-[11px] font-medium text-white hover:bg-danger/80 transition-colors"
								>
									Stop
								</button>
							) : allDone ? (
								<span className="text-[11px] font-medium text-success">Complete</span>
							) : canResume ? (
								<button
									onClick={() => runPipeline(firstIncomplete!.step, { filament: selectedFilament || undefined, silverink_only: silverinkOnly })}
									className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition-colors"
								>
									Resume
								</button>
							) : (
								<button
									onClick={() => runPipeline(undefined, { filament: selectedFilament || undefined, silverink_only: silverinkOnly })}
									className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition-colors"
								>
									Start
								</button>
							)}
						</div>
					</div>

					{filaments.length > 0 && !running && !allDone && (
						<div className="px-3 py-1.5 border-b border-border">
							<select
								value={selectedFilament}
								onChange={e => setSelectedFilament(e.target.value)}
								title="Filament"
								className="w-full rounded-md border border-border bg-surface-card px-2 py-1 text-[11px] text-fg-secondary"
							>
								<option value="">Default filament</option>
								{filaments.map(f => (
									<option key={f.id} value={f.id}>{f.label}</option>
								))}
							</select>
						</div>
					)}

					<div className="flex-1 overflow-y-auto py-1">
						{steps.map(s => (
							<StepRow key={s.step} s={s} onInform={!running ? handleInform : undefined} />
						))}
					</div>

					{allDone && sessionId && (
						<div className="border-t border-border p-3 flex flex-col gap-1.5">
							<span className="text-[11px] font-semibold text-fg mb-0.5">Output Files</span>
							<a href={getGCodeDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-md bg-surface-card px-2.5 py-1.5 text-[11px] text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">enclosure.gcode</span>
							</a>
							<a href={getStlDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-md bg-surface-card px-2.5 py-1.5 text-[11px] text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">enclosure.stl</span>
							</a>
							<a href={getBitmapDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-md bg-surface-card px-2.5 py-1.5 text-[11px] text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">trace_bitmap.txt</span>
							</a>
							<a href={getPrintJobDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-md bg-surface-card px-2.5 py-1.5 text-[11px] text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">print_job.json</span>
							</a>
							<a href={getBundleDownloadUrl(sessionId)} download className="mt-1 flex items-center justify-center rounded-md bg-success px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-success/80 transition-colors">
								Download Bundle (.zip)
							</a>
						</div>
					)}
				</div>

				{/* Right: Viewport */}
				<div className="flex-1 flex flex-col overflow-hidden">
					<div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
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
							<div className="flex items-center justify-center h-full text-xs text-fg-secondary">
								{running ? 'Running pipeline…' : 'Start the pipeline to view results'}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
