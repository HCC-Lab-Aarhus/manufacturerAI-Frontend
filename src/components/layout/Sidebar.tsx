'use client'

import Link from 'next/link'
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

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
		renameSession,
		deleteSession,
		printer,
		setPrinter
	} = useSession()
	const { clearAll } = usePipeline()
	const [printers, setPrinters] = useState<Printer[]>([])
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
	const [renamingId, setRenamingId] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const menuRef = useRef<HTMLDivElement>(null)

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
		if (!menuOpenId) { return }
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpenId(null)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => { document.removeEventListener('mousedown', handleClick) }
	}, [menuOpenId])

	const handleRenameStart = useCallback((id: string, currentName: string) => {
		setMenuOpenId(null)
		setRenamingId(id)
		setRenameValue(currentName)
	}, [])

	const handleRenameSubmit = useCallback(async (id: string) => {
		const trimmed = renameValue.trim()
		if (trimmed) {
			await renameSession(id, trimmed)
		}
		setRenamingId(null)
	}, [renameValue, renameSession])

	const handleDelete = useCallback(async (id: string) => {
		setMenuOpenId(null)
		await deleteSession(id)
	}, [deleteSession])

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
								<li key={s.id} className="group relative">
									{renamingId === s.id ? (
										<form
											onSubmit={e => { e.preventDefault(); handleRenameSubmit(s.id) }}
											className="rounded-lg px-3 py-2"
										>
											<input
												autoFocus
												value={renameValue}
												onChange={e => { setRenameValue(e.target.value) }}
												onBlur={() => { handleRenameSubmit(s.id) }}
												onKeyDown={e => { if (e.key === 'Escape') { setRenamingId(null) } }}
												className="w-full rounded border border-accent bg-surface-card px-2 py-1 text-sm text-fg outline-none"
											/>
										</form>
									) : (
										<div className={`flex items-center rounded-lg transition-colors ${
										currentSession?.id === s.id
									? 'bg-surface-active text-accent-text'
									: 'text-fg-secondary hover:bg-surface-hover hover:text-fg'
									}`}>
											<button
												onClick={() => { handleSelectSession(s.id) }}
												className="flex-1 min-w-0 px-3 py-2 text-left text-sm"
											>
												<span className="block truncate font-medium">
													{s.name ?? s.description ?? s.id}
												</span>
												<span className="block text-xs text-fg-secondary">
													{new Date(s.created).toLocaleString()}
												</span>
											</button>
											<div className="relative" ref={menuOpenId === s.id ? menuRef : undefined}>
												<button
													onClick={e => { e.stopPropagation(); setMenuOpenId(prev => prev === s.id ? null : s.id) }}
													className="shrink-0 rounded p-1 text-fg-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-fg transition-all"
													title="Session options"
												>
													<svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
														<circle cx={8} cy={3} r={1.5} />
														<circle cx={8} cy={8} r={1.5} />
														<circle cx={8} cy={13} r={1.5} />
													</svg>
												</button>
												{menuOpenId === s.id && (
													<div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-surface-card py-1 shadow-lg">
														<button
															onClick={() => { handleRenameStart(s.id, s.name ?? s.description ?? '') }}
															className="w-full px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-hover transition-colors"
														>
															{'Rename'}
														</button>
														<button
															onClick={() => { handleDelete(s.id) }}
															className="w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-surface-hover transition-colors"
														>
															{'Delete'}
														</button>
													</div>
												)}
											</div>
										</div>
									)}
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
