'use client'

import { type FormEvent, type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import type { TokenUsage } from '@/types/models'

function TokenRing ({ usage }: { usage: TokenUsage }): ReactElement {
	const ratio = Math.min(usage.input_tokens / usage.budget, 1)
	const r = 11
	const circ = 2 * Math.PI * r
	const offset = circ * (1 - ratio)
	const color = ratio > 0.9 ? 'var(--color-danger)' : ratio > 0.7 ? 'var(--color-warning, #d29922)' : 'var(--color-accent)'

	return (
		<div className="relative flex items-center justify-center" title={`${usage.input_tokens.toLocaleString()} / ${usage.budget.toLocaleString()} tokens`}>
			<svg width={28} height={28} className="-rotate-90">
				<circle cx={14} cy={14} r={r} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-border" />
				<circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={2.5}
					strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
			</svg>
			<span className="absolute text-[7px] font-medium text-fg-muted rotate-0">
				{ratio < 0.01 ? '' : `${Math.round(ratio * 100)}%`}
			</span>
		</div>
	)
}

interface ChatInputProps {
	onSend: (message: string) => void
	disabled?: boolean
	placeholder?: string
	streaming?: boolean
	onStop?: () => void
	tokenUsage?: TokenUsage | null
}

export default function ChatInput ({ onSend, disabled, placeholder, streaming, onStop, tokenUsage }: ChatInputProps): ReactElement {
	const [value, setValue] = useState('')
	const [listening, setListening] = useState(false)
	const recognitionRef = useRef<SpeechRecognition | null>(null)

	useEffect(() => {
		return () => { recognitionRef.current?.abort() }
	}, [])

	const toggleListening = useCallback(() => {
		if (listening) {
			recognitionRef.current?.stop()
			setListening(false)
			return
		}

		const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
		if (!SpeechRecognition) { return }

		const recognition = new SpeechRecognition()
		recognition.lang = 'en-US'
		recognition.interimResults = false
		recognition.continuous = false

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			const transcript = event.results[0]?.[0]?.transcript
			if (transcript) { setValue(prev => (prev ? prev + ' ' : '') + transcript) }
		}
		recognition.onerror = () => { setListening(false) }
		recognition.onend = () => { setListening(false) }

		recognition.start()
		recognitionRef.current = recognition
		setListening(true)
	}, [listening])

	const handleSubmit = useCallback((e: FormEvent) => {
		e.preventDefault()
		const trimmed = value.trim()
		if (!trimmed || disabled) { return }
		onSend(trimmed)
		setValue('')
	}, [value, disabled, onSend])

	return (
		<form onSubmit={handleSubmit} className="flex items-center gap-2">
			<div className="relative flex-1">
				<input
					type="text"
					value={value}
					onChange={e => { setValue(e.target.value) }}
					disabled={disabled}
					placeholder={placeholder ?? 'Describe your device…'}
					className="w-full rounded-xl border border-border bg-surface-card px-4 py-2.5 pr-10 text-sm text-fg placeholder-fg-muted outline-none focus:border-accent disabled:opacity-50 transition-colors"
				/>
				<button
					type="button"
					onClick={toggleListening}
					disabled={disabled}
					className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${listening ? 'text-danger animate-pulse' : 'text-fg-muted hover:text-fg'} disabled:opacity-40`}
					title={listening ? 'Stop listening' : 'Speech to text'}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
						<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
						<line x1="12" x2="12" y1="19" y2="22" />
					</svg>
				</button>
			</div>
			{tokenUsage && <TokenRing usage={tokenUsage} /> }
			{streaming
				? (
					<button
						type="button"
						onClick={onStop}
						className="rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-danger-hover transition-colors"
					>
						{'Stop'}
					</button>
				)
				: (
					<button
						type="submit"
						disabled={disabled || !value.trim()}
						className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						{'Send'}
					</button>
				)}
		</form>
	)
}
