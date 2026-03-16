'use client'

import Link from 'next/link'
import { type ReactElement, useCallback, useEffect, useState } from 'react'

import ColorPicker from '@/components/ui/ColorPicker'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { getStoredPrinterId, useSession } from '@/contexts/SessionContext'
import { listPrinters, setSessionPrinter } from '@/lib/api'
import type { Printer } from '@/types/models'

export default function Sidebar (): ReactElement {
	const {
		sessions,
		currentSession,
		loading,
		selectSession,
		clearSession,
		refreshSessions,
		patchSession,
		setActiveStage,
		printer,
		setPrinter
	} = useSession()
	const { clearAll } = usePipeline()
	const [printers, setPrinters] = useState<Printer[]>([])

	useEffect(() => {
		listPrinters().then(setPrinters).catch(() => {})
	}, [])

	useEffect(() => {
		if (printers.length === 0 || printer) { return }
		const storedId = getStoredPrinterId()
		if (storedId) {
			const found = printers.find(p => p.id === storedId) ?? null
			if (found) { setPrinter(found) }
		}
	}, [printers, printer, setPrinter])

	const handleNewSession = useCallback(() => {
		clearAll()
		clearSession()
	}, [clearAll, clearSession])

	const handleSelectSession = useCallback(async (id: string) => {
		clearAll()
		setActiveStage('design')
		await selectSession(id)
	}, [clearAll, selectSession, setActiveStage])

	const handlePrinterChange = useCallback(async (printerId: string) => {
		if (!currentSession) { return }
		const result = await setSessionPrinter(currentSession.id, printerId)
		const found = printers.find(p => p.id === result.printer_id) ?? null
		setPrinter(found)
		patchSession({
			invalidated_steps: result.invalidated_steps,
			artifacts: result.artifacts,
			pipeline_errors: result.pipeline_errors,
		})
	}, [currentSession, printers, setPrinter, patchSession])

	useEffect(() => {
		refreshSessions()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-alt">
			<div className="p-4 pb-3">
				<h1 className="text-lg font-bold text-fg">{'ManufacturerAI'}</h1>
				<p className="text-xs text-fg-secondary">{'Hardware design pipeline'}</p>
			</div>

			<div className="px-3 pb-3">
				<button
					onClick={handleNewSession}
					className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
				>
					{'+ New Session'}
				</button>
			</div>

			{printers.length > 0 && (
				<div className="px-3 pb-3">
					<label className="text-xs text-fg-secondary">{'Printer'}</label>
					<select
						title="Select printer"
						value={printer?.id ?? currentSession?.printer_id ?? ''}
						onChange={e => { handlePrinterChange(e.target.value) }}
						disabled={!currentSession}
						className="mt-1 w-full rounded-lg border border-border bg-surface-card px-2 py-1.5 text-sm text-fg-secondary outline-none disabled:opacity-50"
					>
						<option value="">{'Select printer…'}</option>
						{printers.map(p => (
							<option key={p.id} value={p.id}>{p.label}</option>
						))}
					</select>
				</div>
			)}

			<div className="flex-1 overflow-y-auto">
				<div className="p-3">
					<p className="mb-2 text-xs font-medium text-fg-secondary uppercase tracking-wider">{'Sessions'}</p>
					{loading && sessions.length === 0 ? (
						<div className="flex justify-center py-4">
							<LoadingSpinner size="sm" />
						</div>
					) : sessions.length === 0 ? (
						<p className="text-xs text-fg-secondary text-center py-4">{'No sessions yet'}</p>
					) : (
						<ul className="space-y-1">
							{sessions.map(s => (
								<li key={s.id}>
									<button
										onClick={() => { handleSelectSession(s.id) }}
										className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
											currentSession?.id === s.id
										? 'bg-surface-active text-accent-text'
										: 'text-fg-secondary hover:bg-surface-hover hover:text-fg'
										}`}
									>
										<span className="block truncate font-medium">
											{s.name ?? s.description ?? s.id}
										</span>
										<span className="block text-xs text-fg-secondary">
											{new Date(s.created).toLocaleString()}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<div className="border-t border-border px-3 py-3 space-y-2">
				<ColorPicker />
				<Link href="/debug" className="block text-xs text-fg-muted hover:text-accent transition-colors">
					{'Calibration Debug →'}
				</Link>
			</div>
		</aside>
	)
}
