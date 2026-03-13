'use client'

import type { ReactElement } from 'react'

import { useSession } from '@/contexts/SessionContext'

import CircuitPanel from './CircuitPanel'
import DesignPanel from './DesignPanel'
import GCodePanel from './GCodePanel'
import PlacementPanel from './PlacementPanel'
import RoutingPanel from './RoutingPanel'
import ScadPanel from './ScadPanel'

const PANELS: Record<string, () => ReactElement> = {
	design: DesignPanel,
	circuit: CircuitPanel,
	placement: PlacementPanel,
	routing: RoutingPanel,
	scad: ScadPanel,
	gcode: GCodePanel
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
