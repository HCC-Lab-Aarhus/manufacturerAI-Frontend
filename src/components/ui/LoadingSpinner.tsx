'use client'

import type { ReactElement } from 'react'

interface LoadingSpinnerProps {
	size?: 'sm' | 'md' | 'lg'
	label?: string
}

const sizeClasses = {
	sm: 'h-4 w-4 border-2',
	md: 'h-6 w-6 border-2',
	lg: 'h-10 w-10 border-3'
}

export default function LoadingSpinner ({ size = 'md', label }: LoadingSpinnerProps): ReactElement {
	return (
		<div className="flex items-center gap-2">
			<div
				className={`animate-spin rounded-full border-border-light border-t-accent ${sizeClasses[size]}`}
			/>
			{label && <span className="text-sm text-fg-secondary">{label}</span>}
		</div>
	)
}
