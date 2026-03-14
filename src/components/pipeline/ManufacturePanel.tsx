'use client'

import { type ReactElement, useEffect, useState } from 'react'

import { useSession } from '@/contexts/SessionContext'
import type { StepStatus, ManufactureStepState } from '@/hooks/useManufacture'
import { useManufacture } from '@/hooks/useManufacture'
import { getBundleDownloadUrl, getGCodeDownloadUrl, getBitmapDownloadUrl, getPrintJobDownloadUrl } from '@/lib/api'
import { listFilaments } from '@/lib/api'
import type { Filament } from '@/types/models'

const STEP_ICONS: Record<string, string> = {
	placement: 'PLC',
	routing: 'RTE',
	bitmap: 'BMP',
	scad: 'CAD',
	compile: 'CMP',
	gcode: 'GCO'
}

const STATUS_STYLES: Record<StepStatus, string> = {
	pending: 'text-stone-600',
	running: 'text-[#5672a0]',
	done: 'text-[#358045]',
	error: 'text-[#b05050]',
	skipped: 'text-stone-600'
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
			s.status === 'running' ? 'bg-[#e8ecf4]' : ''
		}`}>
			<span className="text-xs font-mono font-semibold text-stone-600 w-8">{STEP_ICONS[s.step]}</span>
			<span className={`flex-1 text-sm font-medium ${STATUS_STYLES[s.status]}`}>
				{s.label}
			</span>
			{s.status === 'running' && (
				<span className="size-3 animate-spin rounded-full border-2 border-[#5672a0] border-t-transparent" />
			)}
			<span className={`text-sm font-bold ${STATUS_STYLES[s.status]}`}>
				{STATUS_BADGE[s.status]}
			</span>
			{s.message && (
				<span className="text-xs text-stone-600">{s.message}</span>
			)}
		</div>
	)
}

export default function ManufacturePanel (): ReactElement {
	const { currentSession } = useSession()
	const { steps, running, allDone, runPipeline, stop } = useManufacture()
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [selectedFilament, setSelectedFilament] = useState<string>('')

	useEffect(() => {
		listFilaments().then(setFilaments).catch(() => {})
	}, [])

	const sessionId = currentSession?.id

	const firstIncomplete = steps.find(s => s.status !== 'done')
	const canResume = !running && firstIncomplete && steps.some(s => s.status === 'done')

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-end px-6 py-3">
				<div className="flex items-center gap-3">
					{filaments.length > 0 && !running && !allDone && (
						<select
							value={selectedFilament}
							onChange={e => setSelectedFilament(e.target.value)}
							className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600"
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
							className="rounded-xl bg-[#b05050] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#9a4040] transition-colors"
						>
							Stop
						</button>
					) : allDone ? (
						<span className="text-sm font-medium text-[#358045]">Complete</span>
					) : canResume ? (
						<button
							onClick={() => runPipeline(firstIncomplete!.step)}
							className="rounded-xl bg-[#7c8dbd] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#6674a6] transition-colors"
						>
							Resume from {firstIncomplete!.label}
						</button>
					) : (
						<button
							onClick={() => runPipeline()}
							className="rounded-xl bg-[#7c8dbd] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#6674a6] transition-colors"
						>
							Start Manufacturing
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto flex max-w-lg flex-col gap-1">
					{steps.map(s => (
						<StepRow key={s.step} s={s} />
					))}
				</div>

				{allDone && sessionId && (
					<div className="mx-auto mt-8 max-w-lg rounded-2xl bg-[#efeee9] p-6">
						<h3 className="mb-4 text-sm font-semibold text-stone-700">Output Files</h3>
						<div className="flex flex-col gap-2">
							<a
								href={getGCodeDownloadUrl(sessionId)}
								download
								className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
							>
								<span className="flex-1 font-medium">enclosure_staged.gcode</span>
								<span className="text-xs text-stone-600">PLA + pause markers</span>
							</a>
							<a
								href={getBitmapDownloadUrl(sessionId)}
								download
								className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
							>
								<span className="flex-1 font-medium">trace_bitmap.txt</span>
								<span className="text-xs text-stone-600">Nozzle-native resolution</span>
							</a>
							<a
								href={getPrintJobDownloadUrl(sessionId)}
								download
								className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
							>
								<span className="flex-1 font-medium">print_job.json</span>
								<span className="text-xs text-stone-600">Print manifest</span>
							</a>
							<a
								href={getBundleDownloadUrl(sessionId)}
								download
								className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#358045] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2d6e3b] transition-colors"
							>
								Download Bundle (.zip)
							</a>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
