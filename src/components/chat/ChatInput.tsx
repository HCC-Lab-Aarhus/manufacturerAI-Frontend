'use client'

import { type FormEvent, type ReactElement, useCallback, useState } from 'react'

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

	const handleSubmit = useCallback((e: FormEvent) => {
		e.preventDefault()
		const trimmed = value.trim()
		if (!trimmed || disabled) { return }
		onSend(trimmed)
		setValue('')
	}, [value, disabled, onSend])

	return (
		<form onSubmit={handleSubmit} className="flex items-center gap-2">
			<input
				type="text"
				value={value}
				onChange={e => { setValue(e.target.value) }}
				disabled={disabled}
				placeholder={placeholder ?? 'Describe your device…'}
				className="flex-1 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm text-fg placeholder-fg-muted outline-none focus:border-accent disabled:opacity-50 transition-colors"
			/>
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
