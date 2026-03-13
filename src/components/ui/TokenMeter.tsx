'use client'

import type { ReactElement } from 'react'

import type { TokenUsage } from '@/types/models'

interface TokenMeterProps {
	usage: TokenUsage | null
}

export default function TokenMeter ({ usage }: TokenMeterProps): ReactElement | null {
	if (!usage) { return null }

	return (
		<div className="flex items-center gap-2 text-xs text-neutral-400">
			<meter
				min={0}
				max={usage.budget}
				value={usage.input_tokens}
				className="h-1.5 w-24 appearance-none"
			/>
			<span>{usage.input_tokens.toLocaleString()}{' / '}{usage.budget.toLocaleString()}</span>
		</div>
	)
}
