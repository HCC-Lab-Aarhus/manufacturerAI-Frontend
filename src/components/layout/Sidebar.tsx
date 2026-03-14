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
		<aside className="flex h-full w-64 shrink-0 flex-col border-r border-stone-200 bg-[#f0eeea]">
			<div className="p-4 pb-3">
				<h1 className="text-lg font-bold text-stone-700">{'ManufacturerAI'}</h1>
				<p className="text-xs text-stone-600">{'Hardware design pipeline'}</p>
			</div>

			<div className="px-3 pb-3">
				<button
					onClick={handleNewSession}
					className="w-full rounded-lg bg-[#5672a0] px-3 py-2 text-sm font-medium text-white hover:bg-[#4a6391] transition-colors"
				>
					{'+ New Session'}
				</button>
			</div>

			{printers.length > 0 && (
				<div className="px-3 pb-3">
					<label className="text-xs text-stone-600">{'Printer'}</label>
					<select
						title="Select printer"
						value={printer?.id ?? currentSession?.printer_id ?? ''}
						onChange={e => { handlePrinterChange(e.target.value) }}
						disabled={!currentSession}
						className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-600 outline-none disabled:opacity-50"
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
					<p className="mb-2 text-xs font-medium text-stone-600 uppercase tracking-wider">{'Sessions'}</p>
					{loading && sessions.length === 0 ? (
						<div className="flex justify-center py-4">
							<LoadingSpinner size="sm" />
						</div>
					) : sessions.length === 0 ? (
						<p className="text-xs text-stone-600 text-center py-4">{'No sessions yet'}</p>
					) : (
						<ul className="space-y-1">
							{sessions.map(s => (
								<li key={s.id}>
									<button
										onClick={() => { handleSelectSession(s.id) }}
										className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
											currentSession?.id === s.id
										? 'bg-[#dde3f0] text-[#485a7a]'
										: 'text-stone-600 hover:bg-stone-100 hover:text-stone-700'
										}`}
									>
										<span className="block truncate font-medium">
											{s.name ?? s.description ?? s.id}
										</span>
										<span className="block text-xs text-stone-600">
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
