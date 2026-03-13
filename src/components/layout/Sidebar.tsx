'use client'

import { type ReactElement, useCallback, useEffect, useState } from 'react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { usePipeline } from '@/contexts/PipelineContext'
import { useSession } from '@/contexts/SessionContext'
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
		printer,
		setPrinter
	} = useSession()
	const { clearAll } = usePipeline()
	const [printers, setPrinters] = useState<Printer[]>([])

	useEffect(() => {
		listPrinters().then(setPrinters).catch(() => {})
	}, [])

	const handleNewSession = useCallback(() => {
		clearAll()
		clearSession()
	}, [clearAll, clearSession])

	const handleSelectSession = useCallback(async (id: string) => {
		clearAll()
		await selectSession(id)
	}, [clearAll, selectSession])

	const handlePrinterChange = useCallback(async (printerId: string) => {
		if (!currentSession) { return }
		const result = await setSessionPrinter(currentSession.id, printerId)
		const found = printers.find(p => p.id === result.printer_id) ?? null
		setPrinter(found)
	}, [currentSession, printers, setPrinter])

	useEffect(() => {
		refreshSessions()
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
			<div className="border-b border-neutral-800 p-4">
				<h1 className="text-lg font-bold text-neutral-100">{'ManufacturerAI'}</h1>
				<p className="text-xs text-neutral-500">{'Hardware design pipeline'}</p>
			</div>

			<div className="border-b border-neutral-800 p-3">
				<button
					onClick={handleNewSession}
					className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
				>
					{'+ New Session'}
				</button>
			</div>

			{currentSession && printers.length > 0 && (
				<div className="border-b border-neutral-800 p-3">
					<label className="text-xs text-neutral-400">{'Printer'}</label>
					<select
						title="Select printer"
						value={printer?.id ?? currentSession.printer_id ?? ''}
						onChange={e => { handlePrinterChange(e.target.value) }}
						className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 outline-none"
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
					<p className="mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">{'Sessions'}</p>
					{loading && sessions.length === 0 ? (
						<div className="flex justify-center py-4">
							<LoadingSpinner size="sm" />
						</div>
					) : sessions.length === 0 ? (
						<p className="text-xs text-neutral-600 text-center py-4">{'No sessions yet'}</p>
					) : (
						<ul className="space-y-1">
							{sessions.map(s => (
								<li key={s.id}>
									<button
										onClick={() => { handleSelectSession(s.id) }}
										className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
											currentSession?.id === s.id
												? 'bg-blue-900/30 text-blue-300'
												: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
										}`}
									>
										<span className="block truncate font-medium">
											{s.name ?? s.description ?? s.id}
										</span>
										<span className="block text-xs text-neutral-600">
											{new Date(s.created).toLocaleString()}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</aside>
	)
}
