'use client'

import { type ReactElement, useCallback, useEffect, useState } from 'react'

interface ErrorWindowProps {
	error: unknown
	onClose: () => void
}

export default function ErrorWindow ({ error, onClose }: ErrorWindowProps): ReactElement {
	const [visible, setVisible] = useState(true)

	const message = error instanceof Error
		? error.message
		: typeof error === 'string'
			? error
			: JSON.stringify(error)

	const handleClose = useCallback(() => {
		setVisible(false)
		setTimeout(onClose, 200)
	}, [onClose])

	useEffect(() => {
		const timer = setTimeout(handleClose, 8000)
		return () => { clearTimeout(timer) }
	}, [handleClose])

	return (
		<div
			className={`m-3 max-w-sm rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-fg shadow-md backdrop-blur-sm transition-all duration-200 ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
		>
			<div className="flex items-start gap-2">
				<span className="mt-0.5 shrink-0 text-error-fg-muted">{'\u26a0'}</span>
				<p className="flex-1 wrap-break-word">{message}</p>
				<button
					onClick={handleClose}
					className="shrink-0 text-error-fg hover:text-error-fg"
				>
					{'×'}
				</button>
			</div>
		</div>
	)
}
