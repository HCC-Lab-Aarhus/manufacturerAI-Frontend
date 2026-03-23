'use client'

import type { ReactElement } from 'react'

import { useSession } from '@/contexts/SessionContext'

import CircuitPanel from './CircuitPanel'
import DesignPanel from './DesignPanel'
import GuidePanel from './GuidePanel'
import ManufacturePanel from './ManufacturePanel'
import SetupPanel from './SetupPanel'

const PANELS: Record<string, () => ReactElement> = {
	design: DesignPanel,
	circuit: CircuitPanel,
	manufacture: ManufacturePanel,
	guide: GuidePanel,
	setup: SetupPanel
}

export default function PipelineContent (): ReactElement {
	const { activeStage } = useSession()
	const Panel = PANELS[activeStage] ?? DesignPanel

	return (
		<div className="flex-1 overflow-hidden">
			<Panel />
		</div>
	)
}
