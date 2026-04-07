'use client'

import dynamic from 'next/dynamic'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
import type { StepStatus, ManufactureStepState } from '@/hooks/useManufacture'
import { useManufacture } from '@/hooks/useManufacture'
import { getBundleDownloadUrl, getGCodeDownloadUrl, getBitmapDownloadUrl, getPrintJobDownloadUrl, getStlDownloadUrl, getExtrasStlDownloadUrl, getTopStlDownloadUrl } from '@/lib/api'
import type { ManufactureStep } from '@/types/models'

const PlacementViewport = dynamic(() => import('@/components/viewport/PlacementViewport'), { ssr: false })
const RoutingViewport = dynamic(() => import('@/components/viewport/RoutingViewport'), { ssr: false })
const InflationViewport = dynamic(() => import('@/components/viewport/InflationViewport'), { ssr: false })
const BitmapViewport = dynamic(() => import('@/components/viewport/BitmapViewport'), { ssr: false })
const Scene3D = dynamic(() => import('@/components/viewport/Scene3D'), { ssr: false })

const ALL_STEPS: ManufactureStep[] = ['placement', 'routing', 'inflation', 'bitmap', 'scad', 'compile', 'gcode']

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
	inflation: 'INF',
	bitmap: 'BMP',
	scad: 'CAD',
	compile: 'CMP',
	gcode: 'GCO'
}

interface StepRowProps {
	s: ManufactureStepState
	running: boolean
	selected?: boolean
	onSelect?: () => void
	onInform?: (agent: 'design' | 'circuit', message: string) => void
	onRetry?: (step: ManufactureStep) => void
	onContinue?: (step: ManufactureStep) => void
	onRunStep?: (step: ManufactureStep) => void
}

function StepRow ({ s, running, selected, onSelect, onInform, onRetry, onContinue, onRunStep }: StepRowProps): ReactElement {
	const hasView = s.step in STEP_TO_TAB
	return (
		<div
			onClick={hasView && onSelect ? onSelect : undefined}
			className={`flex flex-col gap-1 px-3 py-1.5 rounded-lg transition-colors ${
				selected ? 'bg-surface-active ring-1 ring-accent/40' : s.status === 'running' ? 'bg-surface-active' : ''
			} ${hasView && onSelect ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
		>
			<div className="flex items-center gap-2.5">
				<span className="text-[10px] font-mono font-semibold text-fg-secondary w-7">{STEP_ICONS[s.step]}</span>
				<span className={`flex-1 text-xs font-medium ${STATUS_STYLES[s.status]}`}>
					{s.label}
				</span>
				{s.status === 'running' && (
					<span className="size-2.5 animate-spin rounded-full border-[1.5px] border-accent border-t-transparent" />
				)}
				{!running && (s.status === 'done' || s.status === 'pending') && onRunStep && (
					<button
						onClick={() => onRunStep(s.step)}
						className="flex items-center justify-center size-6 rounded text-[10px] text-fg-muted hover:text-accent hover:bg-surface-hover transition-colors"
						title={`Run ${s.label}`}
					>
						{'▶'}
					</button>
				)}
				<span className={`text-xs font-bold ${STATUS_STYLES[s.status]}`}>
					{STATUS_BADGE[s.status]}
				</span>
			</div>
			{s.status === 'error' && s.message && (
				<div className="ml-9 mt-0.5 flex flex-col gap-1.5">
					<p className="text-[11px] text-danger leading-relaxed">{s.message}</p>
					<div className="flex items-center gap-2">
						{onRetry && (
							<button
								onClick={() => onRetry(s.step)}
								className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-on-accent-muted hover:bg-accent-hover transition-colors"
							>
								{'Retry'}
							</button>
						)}
						{onContinue && (
							<button
								onClick={() => onContinue(s.step)}
								className="rounded-md bg-surface-chip px-2.5 py-1 text-[11px] font-medium text-fg-secondary hover:bg-surface-hover transition-colors"
							>
								{'Skip & Continue'}
							</button>
						)}
						{s.responsibleAgent && onInform && (
							<button
								onClick={() => onInform(s.responsibleAgent!, s.message!)}
								className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-on-accent-muted hover:bg-accent-hover transition-colors"
							>
								{s.responsibleAgent === 'design' ? 'Inform the Designer' : 'Inform the Circuit'}
							</button>
						)}
					</div>
				</div>
			)}
			{s.status !== 'error' && s.message && (
				<pre className="ml-9 text-[11px] text-fg-secondary whitespace-pre-wrap font-sans leading-relaxed">{s.message}</pre>
			)}
		</div>
	)
}

type ViewTab = 'placement' | 'routing' | 'inflation' | 'bitmap' | 'scad' | 'stl' | 'stl-top' | 'extras'

const STEP_TO_TAB: Record<string, ViewTab> = {
	placement: 'placement',
	routing: 'routing',
	inflation: 'inflation',
	bitmap: 'bitmap',
	scad: 'scad',
	compile: 'stl'
}

export default function ManufacturePanel (): ReactElement {
	const { currentSession, setActiveStage, filament, flashDropdowns } = useSession()
	const { setPendingFeedback } = usePipeline()
	const { steps, running, allDone, currentStep, placementResult, routingResult, inflationResult, bitmapResult, runPipeline, stop } = useManufacture()
	const compileReady = steps.find(s => s.step === 'compile')?.status !== 'running'
	const [silverinkOnly, setSilverinkOnly] = useState(false)
	const [twoPart, setTwoPart] = useState(false)
	const [viewTab, setViewTab] = useState<ViewTab>('placement')
	const prevDoneRef = useRef<Set<string>>(new Set(steps.filter(s => s.status === 'done').map(s => s.step)))

	useEffect(() => {
		setViewTab('placement')
		prevDoneRef.current = new Set()
	}, [currentSession?.id])

	useEffect(() => {
		const nowDone = new Set(steps.filter(s => s.status === 'done').map(s => s.step))
		for (const step of nowDone) {
			if (!prevDoneRef.current.has(step) && step in STEP_TO_TAB) {
				setViewTab(STEP_TO_TAB[step])
			}
		}
		prevDoneRef.current = nowDone
	}, [steps])

	useEffect(() => {
		if (currentStep && currentStep in STEP_TO_TAB) {
			setViewTab(STEP_TO_TAB[currentStep])
		}
	}, [currentStep])

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

	const selectedFilament = filament?.id ?? currentSession?.filament_id ?? ''

	const opts = useCallback(() => ({ filament: selectedFilament, silverink_only: silverinkOnly, two_part: twoPart }), [selectedFilament, silverinkOnly, twoPart])

	const canStart = !!selectedFilament

	const requireFilament = useCallback((): boolean => {
		if (canStart) { return true }
		flashDropdowns()
		return false
	}, [canStart, flashDropdowns])

	const handleRetry = useCallback((step: ManufactureStep) => {
		if (!requireFilament()) { return }
		runPipeline(step, opts())
	}, [runPipeline, opts, requireFilament])

	const handleContinue = useCallback((step: ManufactureStep) => {
		if (!requireFilament()) { return }
		const idx = ALL_STEPS.indexOf(step)
		const next = ALL_STEPS[idx + 1]
		if (next) { runPipeline(next, opts()) }
	}, [runPipeline, opts, requireFilament])

	const handleRunStep = useCallback((step: ManufactureStep) => {
		if (!requireFilament()) { return }
		runPipeline(step, opts())
	}, [runPipeline, opts, requireFilament])

	const handleSelectStep = useCallback((step: ManufactureStep) => {
		if (step in STEP_TO_TAB) { setViewTab(STEP_TO_TAB[step]) }
	}, [])


	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 flex overflow-hidden">
				{/* Left: Steps panel */}
				<div className="w-72 shrink-0 flex flex-col border-r border-divider">
					<div className="flex items-center justify-between px-3 py-2 border-b border-border">
						<span className="text-xs font-semibold text-fg">{'Steps'}</span>
						<div className="flex items-center gap-2">
							<label className="flex items-center gap-1 text-[11px] text-fg-secondary">
								<input
									type="checkbox"
									checked={silverinkOnly}
									onChange={e => setSilverinkOnly(e.target.checked)}
									className="rounded border-border-light"
									disabled={running}
								/>
								{'SilverInk'}
							</label>
							<label className="flex items-center gap-1 text-[11px] text-fg-secondary">
								<input
									type="checkbox"
									checked={twoPart}
									onChange={e => setTwoPart(e.target.checked)}
									className="rounded border-border-light"
									disabled={running}
								/>
								{'Two-Part'}
							</label>
							{running ? (
								<button
									onClick={stop}
									className="rounded-md bg-danger px-2.5 py-1 text-[11px] font-medium text-on-danger hover:bg-danger/80 transition-colors"
								>
									{'Stop'}
								</button>
							) : allDone ? (
								<>
									<span className="text-[11px] font-medium text-success">{'Complete'}</span>
									<button
										onClick={() => { if (!requireFilament()) return; runPipeline('placement', { silverink_only: silverinkOnly }) }}
										className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-on-accent-muted hover:bg-accent-hover transition-colors"
									>
										{'Re-run'}
									</button>
								</>
							) : canResume ? (
								<button
									onClick={() => { if (!requireFilament()) return; runPipeline(firstIncomplete!.step, { silverink_only: silverinkOnly }) }}
									className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-on-accent-muted hover:bg-accent-hover transition-colors"
								>
									{'Resume'}
								</button>
							) : (
								<button
									onClick={() => { if (!requireFilament()) return; runPipeline(undefined, { silverink_only: silverinkOnly }) }}
									className="rounded-md bg-accent-muted px-2.5 py-1 text-[11px] font-medium text-on-accent-muted hover:bg-accent-hover transition-colors"
								>
									{'Start'}
								</button>
							)}
						</div>
					</div>

					<div className="flex-1 overflow-y-auto py-1">
						{steps.map(s => (
							<StepRow
								key={s.step}
								s={s}
								running={running}
								selected={STEP_TO_TAB[s.step] === viewTab}
								onSelect={() => handleSelectStep(s.step)}
								onInform={!running ? handleInform : undefined}
								onRetry={!running ? handleRetry : undefined}
								onContinue={!running ? handleContinue : undefined}
								onRunStep={!running ? handleRunStep : undefined}
							/>
						))}
					</div>

					{allDone && sessionId && (
						<div className="border-t border-border p-4 flex flex-col gap-2">
							<span className="text-xs font-semibold text-fg">{'Output Files'}</span>
							<a href={getGCodeDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">{'enclosure.gcode'}</span>
								<span className="text-[10px] text-fg-secondary">{'G-code'}</span>
							</a>
							<a href={getStlDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">{'enclosure.stl'}</span>
								<span className="text-[10px] text-fg-secondary">{'3D model'}</span>
							</a>
							<a href={getExtrasStlDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">{'extras.stl'}</span>
								<span className="text-[10px] text-fg-secondary">{'Extra parts'}</span>
							</a>
							{twoPart && (
								<a href={getTopStlDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
									<span className="flex-1 font-medium">{'enclosure_top.stl'}</span>
									<span className="text-[10px] text-fg-secondary">{'Top enclosure'}</span>
								</a>
							)}
							<a href={getBitmapDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">{'trace_bitmap.txt'}</span>
								<span className="text-[10px] text-fg-secondary">{'Bitmap'}</span>
							</a>
							<a href={getPrintJobDownloadUrl(sessionId)} download className="flex items-center gap-2 rounded-lg bg-surface-card px-3 py-2 text-xs text-fg hover:bg-surface-hover transition-colors">
								<span className="flex-1 font-medium">{'print_job.json'}</span>
								<span className="text-[10px] text-fg-secondary">{'Manifest'}</span>
							</a>
							<a href={getBundleDownloadUrl(sessionId)} download className="mt-1 flex items-center justify-center rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-on-success hover:bg-success/80 transition-colors">
								{'Download Bundle (.zip)'}
							</a>
						</div>
					)}
				</div>

				{/* Right: Viewport */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{(viewTab === 'stl' || viewTab === 'stl-top' || viewTab === 'extras') && sessionId && (
						<div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
							<button
								onClick={() => setViewTab('stl')}
								className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
									viewTab === 'stl' ? 'bg-surface-active text-fg ring-1 ring-accent/40' : 'text-fg-secondary hover:bg-surface-hover'
								}`}
							>
								{'Enclosure'}
							</button>
							{twoPart && (
								<button
									onClick={() => setViewTab('stl-top')}
									className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
										viewTab === 'stl-top' ? 'bg-surface-active text-fg ring-1 ring-accent/40' : 'text-fg-secondary hover:bg-surface-hover'
									}`}
								>
									{'Top Enclosure'}
								</button>
							)}
							<button
								onClick={() => setViewTab('extras')}
								className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
									viewTab === 'extras' ? 'bg-surface-active text-fg ring-1 ring-accent/40' : 'text-fg-secondary hover:bg-surface-hover'
								}`}
							>
								{'Extra Parts'}
							</button>
						</div>
					)}
					<div className="flex-1 overflow-hidden">
						{viewTab === 'placement' && placementResult ? (
							<PlacementViewport placement={placementResult} className="w-full h-full" />
						) : viewTab === 'routing' && routingResult ? (
							<RoutingViewport routing={routingResult} className="w-full h-full" />
						) : viewTab === 'inflation' && (inflationResult || routingResult) ? (
							<InflationViewport routing={inflationResult ?? routingResult!} className="w-full h-full" />
						) : viewTab === 'bitmap' && bitmapResult ? (
							<BitmapViewport bitmap={bitmapResult} className="w-full h-full" />
					) : viewTab === 'scad' && placementResult ? (
						<Scene3D placement={placementResult} routing={routingResult} className="w-full h-full" />
					) : viewTab === 'stl' && sessionId && compileReady ? (
						<Scene3D
							key="stl-bottom"
							placement={placementResult}
							routing={routingResult}
							stlUrl={getStlDownloadUrl(sessionId)}
							className="w-full h-full"
						/>
					) : viewTab === 'stl-top' && sessionId && compileReady ? (
						<Scene3D
							key="stl-top"
							stlUrl={getTopStlDownloadUrl(sessionId)}
							className="w-full h-full"
						/>
					) : viewTab === 'extras' && sessionId && compileReady ? (
						<Scene3D
							key="stl-extras"
							stlUrl={getExtrasStlDownloadUrl(sessionId)}
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
