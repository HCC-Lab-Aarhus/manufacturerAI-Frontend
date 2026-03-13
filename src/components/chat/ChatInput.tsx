'use client'

import { type FormEvent, type ReactElement, useCallback, useState } from 'react'

interface ChatInputProps {
	onSend: (message: string) => void
	disabled?: boolean
	placeholder?: string
}

export default function ChatInput ({ onSend, disabled, placeholder }: ChatInputProps): ReactElement {
	const [value, setValue] = useState('')

	const handleSubmit = useCallback((e: FormEvent) => {
		e.preventDefault()
		const trimmed = value.trim()
		if (!trimmed || disabled) { return }
		onSend(trimmed)
		setValue('')
	}, [value, disabled, onSend])

	return (
		<form onSubmit={handleSubmit} className="flex gap-2">
			<input
				type="text"
				value={value}
				onChange={e => { setValue(e.target.value) }}
				disabled={disabled}
				placeholder={placeholder ?? 'Describe your device…'}
				className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500 disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={disabled || !value.trim()}
				className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			>
				{'Send'}
			</button>
		</form>
	)
}
