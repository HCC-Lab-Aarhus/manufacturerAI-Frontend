'use client'

import { type FormEvent, type ReactElement, useCallback, useState } from 'react'

interface ChatInputProps {
	onSend: (message: string) => void
	disabled?: boolean
	placeholder?: string
	streaming?: boolean
	onStop?: () => void
}

export default function ChatInput ({ onSend, disabled, placeholder, streaming, onStop }: ChatInputProps): ReactElement {
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
				className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 placeholder-stone-500 outline-none focus:border-[#5672a0] disabled:opacity-50 transition-colors"
			/>
			{streaming
				? (
					<button
						type="button"
						onClick={onStop}
						className="rounded-xl bg-[#b05050] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a4040] transition-colors"
					>
						{'Stop'}
					</button>
				)
				: (
					<button
						type="submit"
						disabled={disabled || !value.trim()}
						className="rounded-xl bg-[#5672a0] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4a6391] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						{'Send'}
					</button>
				)}
		</form>
	)
}
