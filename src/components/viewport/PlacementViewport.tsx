'use client'

import type { ReactElement } from 'react'

import ComponentIcon from './ComponentIcon'
import OutlineSVG from './OutlineSVG'
import type { PlacementResult } from '@/types/models'
import { normalizeOutline, normalizeHoles } from '@/lib/viewport'

interface Props {
	placement: PlacementResult
	className?: string
}

export default function PlacementViewport ({ placement, className }: Props): ReactElement {
	const outline = normalizeOutline(placement.outline)
	const holes = normalizeHoles(placement.outline)
	const components = placement.components ?? []

	return (
		<OutlineSVG outline={outline} holes={holes} pcbContour={placement.pcb_contour} className={className}>
			{components.map(c => {
				if (!c.body) {
					return (
						<g key={c.instance_id}>
							<circle cx={c.x_mm * 4} cy={c.y_mm * 4} r={6} fill="#5672a0" opacity={0.5} />
						</g>
					)
				}

				return (
					<ComponentIcon
						key={c.instance_id}
						x={c.x_mm}
						y={c.y_mm}
						rotation={c.rotation_deg}
						body={c.body}
						pins={c.pins ?? []}
						label={c.instance_id}
					/>
				)
			})}
		</OutlineSVG>
	)
}
