'use client'

import { type ReactElement, useCallback, useEffect } from 'react'

import ChatLog from '@/components/chat/ChatLog'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useSession } from '@/contexts/SessionContext'
import { useSetupAgent } from '@/hooks/useSetupAgent'

export default function SetupPanel (): ReactElement {
	const { currentSession, loading } = useSession()
	const {
		messages,
		streaming,
		conversationLoading,
		firmwareCode,
		compiled,
		runSetup,
		loadConversation,
		resetConversation
	} = useSetupAgent()

	useEffect(() => {
		if (currentSession) {
			loadConversation(currentSession.id)
		} else {
			resetConversation()
		}
	}, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

	const hasManufacture = currentSession?.pipeline_state.gcode === 'complete' ||
		currentSession?.pipeline_state.gcode === 'done'
	const hasConversation = messages.length > 0 || streaming

	const handleDownload = useCallback(() => {
		if (!firmwareCode) return
		const blob = new Blob([firmwareCode], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'firmware.ino'
		a.click()
		URL.revokeObjectURL(url)
	}, [firmwareCode])

	if (loading || conversationLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<LoadingSpinner size="md" />
			</div>
		)
	}

	if (!hasManufacture) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary text-sm">
				{'Complete the Manufacture stage first'}
			</div>
		)
	}

	const chatColumn = (
		<div className="flex h-full flex-col">
			{hasConversation ? (
				<ChatLog messages={messages} />
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
					<div className="text-center">
						<h2 className="text-lg font-semibold text-fg mb-2">Firmware Generation</h2>
						<p className="text-sm text-fg-secondary max-w-md">
							{'The setup agent will analyze your circuit and generate Arduino firmware for the ATmega328P MCU.'}
						</p>
					</div>
					<button
						onClick={runSetup}
						disabled={!currentSession || streaming}
						className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-accent-hover hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
					>
						{'▶ Generate Firmware'}
					</button>
				</div>
			)}
		</div>
	)

	const codeColumn = firmwareCode ? (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface-alt">
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-fg-secondary">firmware.ino</span>
					{compiled && (
						<span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
							{'COMPILED'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{streaming ? (
						<LoadingSpinner size="sm" label="Generating…" />
					) : (
						<button
							onClick={runSetup}
							disabled={!currentSession}
							className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
						>
							{'Re-run'}
						</button>
					)}
					<button
						onClick={handleDownload}
						className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover transition-colors"
					>
						{'↓ Download .ino'}
					</button>
				</div>
			</div>
			<div className="flex-1 overflow-auto">
				<pre className="p-4 text-xs leading-relaxed text-fg font-mono whitespace-pre-wrap break-words">
					<code>{firmwareCode}</code>
				</pre>
			</div>
		</div>
	) : null

	return (
		<div className="flex h-full">
			<div className={`flex flex-col border-r border-border ${firmwareCode ? 'w-1/2' : 'flex-1'}`}>
				{chatColumn}
			</div>
			{codeColumn && (
				<div className="w-1/2 overflow-hidden">
					{codeColumn}
				</div>
			)}
		</div>
	)
}
