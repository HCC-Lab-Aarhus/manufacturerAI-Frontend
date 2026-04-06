'use client'

import { type ReactElement, useState } from 'react'

import { SCALE, netColor, normalizeOutline, normalizeHoles } from '@/lib/viewport'
import type { InflatedTrace, RoutingResult } from '@/types/models'

import ComponentIcon from './ComponentIcon'
import OutlineSVG from './OutlineSVG'

function inflatedPathD (it: InflatedTrace): string {
	const ring = (pts: [number, number][]) =>
		pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x * SCALE},${y * SCALE}`).join(' ') + ' Z'
	let d = ring(it.polygon)
	if (it.holes) {
		for (const hole of it.holes) {
			d += ' ' + ring(hole)
		}
	}
	return d
}

interface Props {
	routing: RoutingResult
	className?: string
}

export default function InflationViewport ({ routing, className }: Props): ReactElement {
	const outline = normalizeOutline(routing.outline)
	const holes = normalizeHoles(routing.outline)
	const components = routing.components ?? []
	const inflated = routing.inflated_traces ?? []
	const traces = routing.traces ?? []
	const traceWidth = (routing.trace_width_mm ?? 0.3) * SCALE

	const uniqueNets = [...new Set(traces.map(t => t.net_id))]
	const [hoveredNet, setHoveredNet] = useState<string | null>(null)
	const pinClearanceMm = routing.pin_clearance_mm ?? 0.9

	return (
		<div className={`flex ${className ?? ''}`}>
			<OutlineSVG outline={outline} holes={holes} pcbContour={routing.pcb_contour} className="flex-1 h-full">
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
							pinClearanceMm={pinClearanceMm}
							dimmed
						/>
					)
				})}

				{inflated.length > 0 ? inflated.map((it, ti) => {
					const idx = uniqueNets.indexOf(it.net_id)
					const color = netColor(idx >= 0 ? idx : ti, uniqueNets.length)
					const dimmed = hoveredNet !== null && hoveredNet !== it.net_id
					return (
						<path
							key={`inf-${ti}`}
							d={inflatedPathD(it)}
							fill={color}
							fillOpacity={0.35}
							stroke={color}
							strokeWidth={0.5}
							fillRule="evenodd"
							onPointerEnter={() => setHoveredNet(it.net_id)}
							onPointerLeave={() => setHoveredNet(null)}
							className={`transition-opacity duration-150 ${dimmed ? 'opacity-[0.15]' : ''}`}
						/>
					)
				}) : traces.map((trace, ti) => {
					const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
					const points = trace.path.map(([x, y]) => `${x * SCALE},${y * SCALE}`).join(' ')
					const dimmed = hoveredNet !== null && hoveredNet !== trace.net_id
					return (
						<g
							key={`trace-${ti}`}
							onPointerEnter={() => setHoveredNet(trace.net_id)}
							onPointerLeave={() => setHoveredNet(null)}
							className={`transition-opacity duration-150 ${dimmed ? 'opacity-[0.15]' : ''}`}
						>
							<polyline
								points={points}
								fill="none"
								stroke={color}
								strokeWidth={traceWidth}
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</g>
					)
				})}
			</OutlineSVG>

			<div className="w-40 shrink-0 overflow-y-auto border-l border-divider px-3 py-3">
				{uniqueNets.length > 0 && (
					<>
						<span className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wide">{'Nets'}</span>
						<div className="mt-1.5 flex flex-col gap-1">
							{uniqueNets.map((netId, i) => {
								const dimmed = hoveredNet !== null && hoveredNet !== netId
								return (
									<div
										key={netId}
										className={`flex items-center gap-2 cursor-pointer transition-opacity duration-150 ${dimmed ? 'opacity-30' : ''}`}
										onPointerEnter={() => setHoveredNet(netId)}
										onPointerLeave={() => setHoveredNet(null)}
									>
										<svg className="size-2.5 shrink-0" viewBox="0 0 10 10">
											<circle cx={5} cy={5} r={5} fill={netColor(i, uniqueNets.length)} />
										</svg>
										<span className="text-[11px] text-fg-secondary truncate">{netId}</span>
									</div>
								)
							})}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
