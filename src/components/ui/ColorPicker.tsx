'use client'

import { type ReactElement, useRef } from 'react'

import { useTheme } from '@/contexts/ThemeContext'
import { DEFAULT_COLOR } from '@/lib/theme'

export default function ColorPicker (): ReactElement {
	const { color, setColor } = useTheme()
	const inputRef = useRef<HTMLInputElement>(null)

	return (
		<div className="flex items-center gap-2">
			<button
				onClick={() => { inputRef.current?.click() }}
				className="size-7 shrink-0 rounded-full border-2 border-border shadow-sm transition-transform hover:scale-110"
				style={{ backgroundColor: color }}
				title="Pick background color"
			/>
			<input
				ref={inputRef}
				type="color"
				value={color}
				title="Pick background color"
				onChange={e => { setColor(e.target.value) }}
				className="sr-only"
			/>
			<span className="text-xs text-fg-muted">Theme</span>
			{color !== DEFAULT_COLOR && (
				<button
					onClick={() => { setColor(DEFAULT_COLOR) }}
					className="ml-auto text-xs text-fg-muted hover:text-fg-secondary transition-colors"
					title="Reset to default"
				>
					Reset
				</button>
			)}
		</div>
	)
}
