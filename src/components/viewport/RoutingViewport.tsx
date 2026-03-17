'use client'

import type { ReactElement } from 'react'

import { SCALE, netColor, normalizeOutline } from '@/lib/viewport'
import type { JumperEndpoint, RoutingResult } from '@/types/models'

import ComponentIcon from './ComponentIcon'
import OutlineSVG from './OutlineSVG'

function jumperXY (ep: JumperEndpoint | [number, number]): [number, number] {
	if (Array.isArray(ep)) return ep
	return [ep.x, ep.y]
}

interface Props {
	routing: RoutingResult
	className?: string
}

export default function RoutingViewport ({ routing, className }: Props): ReactElement {
	const outline = normalizeOutline(routing.outline)
	const components = routing.components ?? []
	const traces = routing.traces ?? []
	const failedNets = routing.failed_nets ?? []
	const jumpers = routing.jumpers ?? []
	const traceWidth = (routing.trace_width_mm ?? 0.3) * SCALE

	const uniqueNets = [...new Set(traces.map(t => t.net_id))]

	return (
		<div className={`flex ${className ?? ''}`}>
			<OutlineSVG outline={outline} pcbContour={routing.pcb_contour} className="flex-1 h-full">
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

				{jumpers.map((j, ji) => {
					const color = netColor(uniqueNets.indexOf(j.net_id), uniqueNets.length)
					const [sx, sy] = jumperXY(j.start)
					const [ex, ey] = jumperXY(j.end)
					return (
						<g key={`jumper-${ji}`}>
							<line
								x1={sx * SCALE} y1={sy * SCALE}
								x2={ex * SCALE} y2={ey * SCALE}
								stroke={color}
								strokeWidth={traceWidth * 0.8}
								strokeDasharray={`${traceWidth * 2},${traceWidth}`}
								strokeLinecap="round"
							/>
							<rect
								x={sx * SCALE - traceWidth} y={sy * SCALE - traceWidth}
								width={traceWidth * 2} height={traceWidth * 2}
								fill={color} opacity={0.7}
							/>
							<rect
								x={ex * SCALE - traceWidth} y={ey * SCALE - traceWidth}
								width={traceWidth * 2} height={traceWidth * 2}
								fill={color} opacity={0.7}
							/>
						</g>
					)
				})}
			</OutlineSVG>

			<div className="w-40 shrink-0 overflow-y-auto border-l border-border px-3 py-3">
				{uniqueNets.length > 0 && (
					<>
						<span className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wide">{'Routed Nets'}</span>
						<div className="mt-1.5 flex flex-col gap-1">
							{uniqueNets.map((netId, i) => (
								<div key={netId} className="flex items-center gap-2">
									<svg className="size-2.5 shrink-0" viewBox="0 0 10 10">
										<circle cx={5} cy={5} r={5} fill={netColor(i, uniqueNets.length)} />
									</svg>
									<span className="text-[11px] text-fg-secondary truncate">{netId}</span>
								</div>
							))}
						</div>
					</>
				)}

				{failedNets.length > 0 && (
					<div className={uniqueNets.length > 0 ? 'mt-3' : ''}>
						<span className="text-[10px] font-semibold text-danger uppercase tracking-wide">{'Failed Nets'}</span>
						<div className="mt-1.5 flex flex-col gap-1">
							{failedNets.map(netId => (
								<div key={netId} className="flex items-center gap-2">
									<svg className="size-2.5 shrink-0" viewBox="0 0 10 10">
										<circle cx={5} cy={5} r={5} fill="#ef4444" />
									</svg>
									<span className="text-[11px] text-danger truncate">{netId}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{jumpers.length > 0 && (
					<div className="mt-3">
						<span className="text-[10px] font-semibold text-warning uppercase tracking-wide">{'Jumper Wires'}</span>
						<div className="mt-1.5 flex flex-col gap-1">
							{jumpers.map((j, i) => {
								const color = netColor(uniqueNets.indexOf(j.net_id), uniqueNets.length)
								return (
									<div key={i} className="flex items-center gap-2">
										<svg className="size-2.5 shrink-0" viewBox="0 0 10 10">
											<rect width={10} height={10} rx={2} fill={color} />
										</svg>
										<span className="text-[11px] text-fg-secondary truncate">{j.net_id} ({j.length_mm.toFixed(1)}mm)</span>
									</div>
								)
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
