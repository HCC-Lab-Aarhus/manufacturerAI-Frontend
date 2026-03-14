'use client'

import type { ReactElement } from 'react'

import type { CatalogBody, CatalogPin, DesignSpec } from '@/types/models'

import ComponentIcon from './ComponentIcon'
import OutlineSVG from './OutlineSVG'

type EnrichedPlacement = DesignSpec['ui_placements'][number] & {
	body?: CatalogBody
	pins?: CatalogPin[]
}

interface Props {
	design: DesignSpec & { pcb_contour?: [number, number][] }
	className?: string
}

export default function DesignViewport ({ design, className }: Props): ReactElement {
	const outline = design.outline?.points ?? []
	const placements = (design.ui_placements ?? []) as EnrichedPlacement[]

	return (
		<OutlineSVG outline={outline} pcbContour={design.pcb_contour} className={className}>
			{placements.map(p => {
				if (!p.body) {
					return (
						<g key={p.instance_id}>
							<circle cx={p.x_mm * 4} cy={p.y_mm * 4} r={6} fill="#5672a0" opacity={0.5} />
							<text x={p.x_mm * 4} y={p.y_mm * 4 + 16} textAnchor="middle" fontSize={7} fill="#6b6560">
								{p.instance_id}
							</text>
						</g>
					)
				}

				return (
					<ComponentIcon
						key={p.instance_id}
						x={p.x_mm}
						y={p.y_mm}
						body={p.body}
						pins={p.pins ?? []}
						label={p.instance_id}
					/>
				)
			})}
		</OutlineSVG>
	)
}
