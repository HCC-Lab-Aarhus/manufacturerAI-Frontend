'use client'

import { type ReactElement, useCallback, useRef, useState } from 'react'

import type { CatalogBody, CatalogPin, DesignSpec, UIPlacement } from '@/types/models'
import { normalizeOutline, normaliseOutline, buildOutlinePath, outlineBBox, snapToEdge, nearestEdge, SCALE, PAD } from '@/lib/viewport'
import { validateUIPlacement, putDesign, submitDesignToConversation } from '@/lib/api/design'

import ComponentIcon from './ComponentIcon'

type EnrichedPlacement = UIPlacement & {
	body?: CatalogBody
	pins?: CatalogPin[]
}

interface Props {
	design: DesignSpec & { pcb_contour?: [number, number][] }
	sessionId?: string
	onDesignUpdate?: (design: DesignSpec) => void
	className?: string
}

function stripEnrichment (design: DesignSpec): DesignSpec {
	const d = JSON.parse(JSON.stringify(design)) as DesignSpec
	const dr = d as unknown as Record<string, unknown>
	delete dr.height_grid
	delete dr.bottom_height_grid
	delete dr.pcb_contour
	for (const c of (d.ui_placements || [])) {
		const cc = c as unknown as Record<string, unknown>
		delete cc.body
		delete cc.pins
		delete cc.ui_placement
		delete cc.cap_diameter_mm
		delete cc.cap_clearance_mm
		delete cc.pin_positions
		delete cc.z_at_position
		delete cc.surface_normal
	}
	return d
}

export default function DesignViewport ({ design, sessionId, onDesignUpdate, className }: Props): ReactElement {
	const outline = normalizeOutline(design.outline)
	const placements = (design.ui_placements ?? []) as EnrichedPlacement[]
	const norm = normaliseOutline(outline)
	const { verts } = norm
	const svgRef = useRef<SVGSVGElement>(null)

	const [dragValid, setDragValid] = useState<'valid' | 'invalid' | 'pending' | null>(null)
	const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null)
	const [dragState, setDragState] = useState<{
		instanceId: string
		idx: number
		offsetX: number
		offsetY: number
	} | null>(null)
	const dragInfoRef = useRef<{
		origX: number
		origY: number
		baseX: number
		baseY: number
		edgeIndex: number | null
		isSideMount: boolean
		currentEdge: number | null
	} | null>(null)
	const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	if (outline.length < 3) {
		return <div className="flex items-center justify-center text-fg-secondary text-sm p-8">No outline data</div>
	}

	const bbox = outlineBBox(outline)
	const vbW = bbox.width * SCALE + PAD * 2
	const vbH = bbox.height * SCALE + PAD * 2
	const vb = `${bbox.minX * SCALE - PAD} ${bbox.minY * SCALE - PAD} ${vbW} ${vbH}`
	const path = buildOutlinePath(outline)

	function svgPoint (e: React.PointerEvent): { x: number; y: number } {
		const svg = svgRef.current
		if (!svg) return { x: 0, y: 0 }
		const pt = svg.createSVGPoint()
		const ctm = svg.getScreenCTM()?.inverse()
		pt.x = e.clientX
		pt.y = e.clientY
		if (ctm) {
			const transformed = pt.matrixTransform(ctm)
			return { x: transformed.x, y: transformed.y }
		}
		return { x: pt.x, y: pt.y }
	}

	const handlePointerDown = useCallback((e: React.PointerEvent, instanceId: string, idx: number) => {
		if (e.button !== 0) return
		e.preventDefault()
		e.stopPropagation()

		const up = placements[idx]
		const pt = svgPoint(e)

		let visualX = up.x_mm
		let visualY = up.y_mm
		if (up.edge_index != null) {
			const snapInfo = snapToEdge(up, verts, norm.zTops, design.enclosure?.height_mm ?? 25)
			visualX = snapInfo.x
			visualY = snapInfo.y
		}

		dragInfoRef.current = {
			origX: up.x_mm,
			origY: up.y_mm,
			baseX: visualX,
			baseY: visualY,
			edgeIndex: up.edge_index ?? null,
			isSideMount: up.edge_index != null,
			currentEdge: up.edge_index ?? null,
		}

		setDragState({
			instanceId,
			idx,
			offsetX: pt.x - visualX * SCALE,
			offsetY: pt.y - visualY * SCALE,
		})
		setDragValid('pending')

		const svg = svgRef.current
		if (svg) svg.setPointerCapture(e.pointerId)
	}, [placements, verts, norm.zTops, design.enclosure?.height_mm]) // eslint-disable-line react-hooks/exhaustive-deps

	const EDGE_THRESHOLD = 3 // mm — auto side-mount when dragging within this distance of an edge

	const handlePointerMove = useCallback((e: React.PointerEvent) => {
		if (!dragState || !dragInfoRef.current) return
		const info = dragInfoRef.current
		const pt = svgPoint(e)

		let newX = (pt.x - dragState.offsetX) / SCALE
		let newY = (pt.y - dragState.offsetY) / SCALE

		const snap = nearestEdge(newX, newY, verts)
		if (snap.dist < EDGE_THRESHOLD) {
			info.isSideMount = true
			info.currentEdge = snap.edgeIndex
			newX = snap.snapX
			newY = snap.snapY
		} else {
			info.isSideMount = false
			info.currentEdge = null
		}

		setDragDelta({
			dx: (newX - info.baseX) * SCALE,
			dy: (newY - info.baseY) * SCALE,
		})

		if (validateTimerRef.current) clearTimeout(validateTimerRef.current)
		if (sessionId) {
			const valX = newX, valY = newY, valEdge = info.currentEdge
			validateTimerRef.current = setTimeout(async () => {
				try {
					const result = await validateUIPlacement(sessionId, {
						instance_id: dragState.instanceId,
						x_mm: valX,
						y_mm: valY,
						...(valEdge != null ? { edge_index: valEdge } : {}),
					})
					setDragValid(result.valid ? 'valid' : 'invalid')
				} catch {
					setDragValid('pending')
				}
			}, 100)
		}
	}, [dragState, verts, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

	const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
		if (!dragState || !dragInfoRef.current) return
		const info = dragInfoRef.current
		const svg = svgRef.current
		if (svg) svg.releasePointerCapture(e.pointerId)
		if (validateTimerRef.current) clearTimeout(validateTimerRef.current)

		const pt = svgPoint(e)
		let newX = Math.round(((pt.x - dragState.offsetX) / SCALE) * 10) / 10
		let newY = Math.round(((pt.y - dragState.offsetY) / SCALE) * 10) / 10

		const snap = nearestEdge(newX, newY, verts)
		let finalEdge: number | null = null
		if (snap.dist < EDGE_THRESHOLD) {
			finalEdge = snap.edgeIndex
			newX = snap.snapX
			newY = snap.snapY
			info.isSideMount = true
		} else {
			info.isSideMount = false
		}

		setDragDelta(null)

		if (Math.abs(newX - info.origX) < 0.2 && Math.abs(newY - info.origY) < 0.2 && finalEdge === info.edgeIndex) {
			setDragState(null)
			setDragValid(null)
			return
		}

		if (sessionId) {
			try {
				const result = await validateUIPlacement(sessionId, {
					instance_id: dragState.instanceId,
					x_mm: newX,
					y_mm: newY,
					...(info.isSideMount && finalEdge != null ? { edge_index: finalEdge } : {}),
				})
				if (!result.valid) {
					setDragValid('invalid')
					setDragState(null)
					setTimeout(() => setDragValid(null), 1500)
					return
				}
			} catch {
				/* proceed on network failure */
			}
		}

		const updated = { ...design }
		const ups = [...(updated.ui_placements ?? [])]
		const placementUpdate: UIPlacement = {
			...ups[dragState.idx],
			x_mm: newX,
			y_mm: newY,
		}
		if (info.isSideMount && finalEdge != null) {
			placementUpdate.edge_index = finalEdge
		} else {
			delete placementUpdate.edge_index
		}
		ups[dragState.idx] = placementUpdate
		updated.ui_placements = ups

		if (sessionId) {
			try {
				const stripped = stripEnrichment(updated)
				const saved = await putDesign(sessionId, stripped)
				onDesignUpdate?.(saved)
				await submitDesignToConversation(sessionId, stripped)
			} catch {
				onDesignUpdate?.(updated)
			}
		} else {
			onDesignUpdate?.(updated)
		}

		setDragValid('valid')
		setDragState(null)
		setTimeout(() => setDragValid(null), 1500)
	}, [dragState, verts, design, sessionId, onDesignUpdate]) // eslint-disable-line react-hooks/exhaustive-deps

	const UI_COLORS = [
		'#58a6ff', '#3fb950', '#d29922', '#f778ba', '#bc8cff',
		'#79c0ff', '#56d364', '#e3b341', '#ff7b72', '#a5d6ff',
	]

	return (
		<div className="flex flex-col w-full h-full">
			<div className="text-xs text-fg-secondary px-3 py-1 border-b border-border">
				Outline — drag components to reposition
			</div>
			<div className="flex-1 overflow-hidden">
				<svg
					ref={svgRef}
					viewBox={vb}
					className={className ?? 'w-full h-full'}
					xmlns="http://www.w3.org/2000/svg"
					onPointerMove={dragState ? handlePointerMove : undefined}
					onPointerUp={dragState ? handlePointerUp : undefined}
					style={{ cursor: dragState ? 'grabbing' : undefined }}
				>
					<defs>
						<pattern id="grid10" width={10 * SCALE} height={10 * SCALE} patternUnits="userSpaceOnUse">
							<line x1={0} y1={0} x2={0} y2={10 * SCALE} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
							<line x1={0} y1={0} x2={10 * SCALE} y2={0} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
						</pattern>
					</defs>
					<rect
						x={bbox.minX * SCALE - PAD}
						y={bbox.minY * SCALE - PAD}
						width={vbW}
						height={vbH}
						fill="url(#grid10)"
					/>
					<path d={path} fill="rgba(86,114,160,0.06)" stroke="#5672a0" strokeWidth={2} />

					{design.pcb_contour && design.pcb_contour.length > 2 && (
						<>
							<path
								d={design.pcb_contour.map((pt, i) =>
									`${i === 0 ? 'M' : 'L'}${pt[0] * SCALE},${pt[1] * SCALE}`
								).join(' ') + 'Z'}
								fill="rgba(0, 180, 0, 0.06)"
								stroke="none"
								pointerEvents="none"
							/>
							<path
								d={design.pcb_contour.map((pt, i) =>
									`${i === 0 ? 'M' : 'L'}${pt[0] * SCALE},${pt[1] * SCALE}`
								).join(' ') + 'Z'}
								fill="none"
								stroke="#00aa44"
								strokeWidth={1.5}
								strokeDasharray="6,3"
								pointerEvents="none"
							/>
						</>
					)}

					{placements.map((p, idx) => {
						const color = UI_COLORS[idx % UI_COLORS.length]
						const isSide = p.edge_index != null
						const isDragging = dragState?.idx === idx

						if (isSide) {
							const snapInfo = snapToEdge(p, verts, norm.zTops, design.enclosure?.height_mm ?? 25)
							return (
								<g
									key={p.instance_id}
									data-drag-idx={idx}
								style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
								transform={isDragging && dragDelta ? `translate(${dragDelta.dx}, ${dragDelta.dy})` : undefined}
								onPointerDown={e => handlePointerDown(e, p.instance_id, idx)}
								>
									{p.body ? (
										<ComponentIcon
											x={snapInfo.x}
											y={snapInfo.y}
											rotation={snapInfo.rot}
											body={p.body}
											pins={p.pins ?? []}
											label={p.instance_id}
											dragValid={isDragging ? dragValid : null}
										/>
									) : (
										<SideMountMarker up={p} verts={verts} />
									)}
									<rect
										x={snapInfo.x * SCALE - 12}
										y={snapInfo.y * SCALE - 12}
										width={24}
										height={24}
										fill="transparent"
									/>
								</g>
							)
						}

						return (
							<g
								key={p.instance_id}
								data-drag-idx={idx}
								style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
								transform={isDragging && dragDelta ? `translate(${dragDelta.dx}, ${dragDelta.dy})` : undefined}
								onPointerDown={e => handlePointerDown(e, p.instance_id, idx)}
							>
								{p.body ? (
									<ComponentIcon
										x={p.x_mm}
										y={p.y_mm}
										body={p.body}
										pins={p.pins ?? []}
										label={p.instance_id}
										highlight={isDragging}
										dragValid={isDragging ? dragValid : null}
									/>
								) : (
									<g>
										<circle
											cx={p.x_mm * SCALE}
											cy={p.y_mm * SCALE}
											r={6}
											fill={color}
											opacity={0.5}
										/>
										<text
											x={p.x_mm * SCALE}
											y={p.y_mm * SCALE - 10}
											textAnchor="middle"
											fontSize={7}
											fill="#90c8ff"
										>
											{p.instance_id}
										</text>
									</g>
								)}
								<rect
									x={p.x_mm * SCALE - ((p.body?.width_mm ?? 6) / 2) * SCALE - 4}
									y={p.y_mm * SCALE - ((p.body?.length_mm ?? p.body?.diameter_mm ?? 6) / 2) * SCALE - 4}
									width={((p.body?.width_mm ?? p.body?.diameter_mm ?? 6)) * SCALE + 8}
									height={((p.body?.length_mm ?? p.body?.diameter_mm ?? 6)) * SCALE + 8}
									fill="transparent"
								/>
							</g>
						)
					})}

					<text
						x={bbox.minX * SCALE + bbox.width * SCALE / 2}
						y={bbox.minY * SCALE - PAD / 2}
						textAnchor="middle"
						fontSize={10}
						fill="#6b6560"
					>
						{bbox.width.toFixed(1)} mm
					</text>
					<text
						x={bbox.minX * SCALE - PAD / 2}
						y={bbox.minY * SCALE + bbox.height * SCALE / 2}
						textAnchor="middle"
						fontSize={10}
						fill="#6b6560"
						transform={`rotate(-90, ${bbox.minX * SCALE - PAD / 2}, ${bbox.minY * SCALE + bbox.height * SCALE / 2})`}
					>
						{bbox.height.toFixed(1)} mm
					</text>
				</svg>
			</div>
		</div>
	)
}

function SideMountMarker ({ up, verts }: { up: EnrichedPlacement; verts: [number, number][] }): ReactElement {
	const n = verts.length
	const i = up.edge_index ?? 0
	const v0 = verts[i]
	const v1 = verts[(i + 1) % n]

	const ex = v1[0] - v0[0], ey = v1[1] - v0[1]
	const edgeLen = Math.hypot(ex, ey)
	if (edgeLen === 0) return <></>

	const dx = ex / edgeLen, dy = ey / edgeLen
	const px = up.x_mm - v0[0], py = up.y_mm - v0[1]
	let t = (px * dx + py * dy) / edgeLen
	t = Math.max(0.02, Math.min(0.98, t))

	const cx = (v0[0] + t * ex) * SCALE
	const cy = (v0[1] + t * ey) * SCALE
	const nx = dy, ny = -dx

	const arrowLen = 8, arrowW = 5
	const tipX = cx + nx * arrowLen * SCALE / 4
	const tipY = cy + ny * arrowLen * SCALE / 4
	const b1x = cx + dx * arrowW, b1y = cy + dy * arrowW
	const b2x = cx - dx * arrowW, b2y = cy - dy * arrowW

	return (
		<>
			<polygon
				points={`${b1x},${b1y} ${tipX},${tipY} ${b2x},${b2y}`}
				fill="#58a6ff"
				opacity={0.7}
			/>
			<circle cx={cx} cy={cy} r={3} fill="#90c8ff" />
			<text
				x={cx + nx * 16}
				y={cy + ny * 16}
				textAnchor="middle"
				fontSize={7}
				fill="#90c8ff"
			>
				{up.instance_id}
			</text>
		</>
	)
}
