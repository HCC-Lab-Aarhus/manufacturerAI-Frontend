'use client'

import type { ReactElement } from 'react'

import { SCALE, netColor, normalizeOutline } from '@/lib/viewport'
import type { RoutingResult } from '@/types/models'

import ComponentIcon from './ComponentIcon'
import OutlineSVG from './OutlineSVG'

interface Props {
	routing: RoutingResult
	className?: string
}

export default function RoutingViewport ({ routing, className }: Props): ReactElement {
	const outline = normalizeOutline(routing.outline)
	const components = routing.components ?? []
	const traces = routing.traces ?? []
	const traceWidth = (routing.trace_width_mm ?? 0.3) * SCALE

	const uniqueNets = [...new Set(traces.map(t => t.net_id))]

	return (
		<OutlineSVG outline={outline} pcbContour={routing.pcb_contour} className={className}>
			{components.map(c => {
				if (!c.body) { return null }
				return (
					<ComponentIcon
						key={c.instance_id}
						x={c.x_mm}
						y={c.y_mm}
						rotation={c.rotation_deg}
						body={c.body}
						pins={c.pins ?? []}
						dimmed
					/>
				)
			})}

			{traces.map((trace, ti) => {
				const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
				const points = trace.path.map(([x, y]) => `${x * SCALE},${y * SCALE}`).join(' ')
				return (
					<polyline
						key={`trace-${ti}`}
						points={points}
						fill="none"
						stroke={color}
						strokeWidth={traceWidth}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				)
			})}

			{traces.map((trace, ti) => {
				const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
				return trace.path.map(([x, y], pi) => (
					(pi === 0 || pi === trace.path.length - 1) && (
						<circle
							key={`pad-${ti}-${pi}`}
							cx={x * SCALE}
							cy={y * SCALE}
							r={traceWidth * 0.8}
							fill={color}
						/>
					)
				))
			})}

			<g transform="translate(10, 10)">
				{uniqueNets.map((netId, i) => (
					<g key={netId} transform={`translate(0, ${i * 14})`}>
						<circle cx={5} cy={0} r={4} fill={netColor(i, uniqueNets.length)} />
						<text x={14} y={3} fontSize={8} fill="#6b6560">{netId}</text>
					</g>
				))}
			</g>
		</OutlineSVG>
	)
}
