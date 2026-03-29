'use client'

import { type ReactElement, useRef } from 'react'

import { useSession } from '@/contexts/SessionContext'
import type { PipelineStage } from '@/types/models'

import CircuitPanel from './CircuitPanel'
import DesignPanel from './DesignPanel'
import GuidePanel from './GuidePanel'
import ManufacturePanel from './ManufacturePanel'
import SetupPanel from './SetupPanel'

const PANELS: { key: PipelineStage; Component: () => ReactElement }[] = [
	{ key: 'design', Component: DesignPanel },
	{ key: 'circuit', Component: CircuitPanel },
	{ key: 'manufacture', Component: ManufacturePanel },
	{ key: 'guide', Component: GuidePanel },
	{ key: 'setup', Component: SetupPanel },
]

export default function PipelineContent (): ReactElement {
	const { activeStage } = useSession()
	const mountedRef = useRef<Set<PipelineStage>>(new Set())
	mountedRef.current.add(activeStage)

	return (
		<div className="flex-1 overflow-hidden relative">
			{PANELS.map(({ key, Component }) => {
				if (!mountedRef.current.has(key)) return null
				return (
					<div
						key={key}
						className={`absolute inset-0 ${key === activeStage ? '' : 'invisible pointer-events-none'}`}
					>
						<Component />
					</div>
				)
			})}
		</div>
	)
}
