'use client'

import { memo, type ReactElement, useCallback, useEffect, useRef, useState } from 'react'

import { useSession } from '@/contexts/SessionContext'
import type { CatalogBody, CatalogPin, DesignSpec, UIPlacement } from '@/types/models'
import { normalizeOutline, normalizeHoles, normaliseOutline, buildOutlinePath, outlineBBox, snapToEdge, nearestEdge, SCALE, PAD } from '@/lib/viewport'
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
	onDesignSubmitted?: () => void
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

const EDGE_THRESHOLD = 3
const DRAG_COLORS = {
	valid:   { fill: 'rgba(52,211,153,0.25)', stroke: '#34d399' },
	invalid: { fill: 'rgba(239,68,68,0.25)',  stroke: '#ef4444' },
	pending: { fill: 'rgba(251,191,36,0.20)', stroke: '#fbbf24' },
}

function DesignViewport ({ design, sessionId, onDesignUpdate, onDesignSubmitted, className }: Props): ReactElement {
	const { patchSession } = useSession()
	const outline = normalizeOutline(design.outline)
	const holes = normalizeHoles(design.outline)
	const placements = (design.ui_placements ?? []) as EnrichedPlacement[]
	const norm = normaliseOutline(outline)
	const { verts } = norm
	const svgRef = useRef<SVGSVGElement>(null)
	const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
	const svgCallbackRef = useCallback((node: SVGSVGElement | null) => {
		svgRef.current = node
		setSvgEl(node)
	}, [])

	const designRef = useRef(design)
	designRef.current = design
	const onDesignUpdateRef = useRef(onDesignUpdate)
	onDesignUpdateRef.current = onDesignUpdate
	const onDesignSubmittedRef = useRef(onDesignSubmitted)
	onDesignSubmittedRef.current = onDesignSubmitted
	const placementsRef = useRef(placements)
	placementsRef.current = placements
	const vertsRef = useRef(verts)
	vertsRef.current = verts
	const normRef = useRef(norm)
	normRef.current = norm

	const dragRef = useRef<{
		idx: number
		instanceId: string
		offsetX: number
		offsetY: number
		origX: number
		origY: number
		baseX: number
		baseY: number
		edgeIndex: number | null
		isSideMount: boolean
		currentEdge: number | null
		groupEl: SVGGElement | null
		validateTimer: ReturnType<typeof setTimeout> | null
		pointerId: number
	} | null>(null)

	const commitSeqRef = useRef(0)
	const pendingAbortRef = useRef<AbortController | null>(null)
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Kept up-to-date every render so effects with [] deps can read the current base bbox
	const bboxBaseRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

	useEffect(() => {
		const svg = svgRef.current
		if (!svg) return

		function svgPoint (e: PointerEvent): { x: number; y: number } {
			const pt = svg!.createSVGPoint()
			const ctm = svg!.getScreenCTM()?.inverse()
			pt.x = e.clientX
			pt.y = e.clientY
			if (ctm) {
				const transformed = pt.matrixTransform(ctm)
				return { x: transformed.x, y: transformed.y }
			}
			return { x: pt.x, y: pt.y }
		}

		function applyDragFeedback (el: SVGGElement, status: 'valid' | 'invalid' | 'pending') {
			const body = el.querySelector<SVGRectElement | SVGCircleElement>('rect, circle')
			if (!body) return
			const c = DRAG_COLORS[status]
			body.setAttribute('fill', c.fill)
			body.setAttribute('stroke', c.stroke)
		}

		function clearDragFeedback (el: SVGGElement) {
			// feedback is cleared when design re-renders from the commit
		}

		function onPointerDown (e: PointerEvent) {
			const group = (e.target as Element).closest<SVGGElement>('g[data-drag-idx]')
			if (!group || e.button !== 0) return
			const idx = parseInt(group.dataset.dragIdx!, 10)
			if (isNaN(idx)) return

			e.preventDefault()
			e.stopPropagation()

			const pls = placementsRef.current
			const up = pls[idx]
			if (!up) return
			const pt = svgPoint(e)
			const v = vertsRef.current
			const n = normRef.current
			const d = designRef.current

			let visualX = up.x_mm
			let visualY = up.y_mm
			if (up.edge_index != null) {
				const snapInfo = snapToEdge(up, v, n.zTops, d.enclosure?.height_mm ?? 25)
				visualX = snapInfo.x
				visualY = snapInfo.y
			}

			dragRef.current = {
				idx,
				instanceId: up.instance_id,
				offsetX: pt.x - visualX * SCALE,
				offsetY: pt.y - visualY * SCALE,
				origX: up.x_mm,
				origY: up.y_mm,
				baseX: visualX,
				baseY: visualY,
				edgeIndex: up.edge_index ?? null,
				isSideMount: up.edge_index != null,
				currentEdge: up.edge_index ?? null,
				groupEl: group,
				validateTimer: null,
				pointerId: e.pointerId,
			}

			group.style.cursor = 'grabbing'
			svg!.style.cursor = 'grabbing'
			applyDragFeedback(group, 'pending')
			svg!.setPointerCapture(e.pointerId)
		}

		function onPointerMove (e: PointerEvent) {
			const drag = dragRef.current
			if (!drag) return
			const pt = svgPoint(e)
			const v = vertsRef.current

			let newX = (pt.x - drag.offsetX) / SCALE
			let newY = (pt.y - drag.offsetY) / SCALE

			const snap = nearestEdge(newX, newY, v)
			if (snap.dist < EDGE_THRESHOLD) {
				drag.isSideMount = true
				drag.currentEdge = snap.edgeIndex
				newX = snap.snapX
				newY = snap.snapY
			} else {
				drag.isSideMount = false
				drag.currentEdge = null
			}

			const dx = (newX - drag.baseX) * SCALE
			const dy = (newY - drag.baseY) * SCALE
			drag.groupEl?.setAttribute('transform', `translate(${dx}, ${dy})`)

			if (drag.validateTimer) clearTimeout(drag.validateTimer)
			if (sessionId) {
				const valX = newX, valY = newY, valEdge = drag.currentEdge
				const instId = drag.instanceId
				const el = drag.groupEl
				drag.validateTimer = setTimeout(async () => {
					try {
						const result = await validateUIPlacement(sessionId, {
							instance_id: instId,
							x_mm: valX,
							y_mm: valY,
							...(valEdge != null ? { edge_index: valEdge } : {}),
						})
						if (el) applyDragFeedback(el, result.valid ? 'valid' : 'invalid')
					} catch {
						if (el) applyDragFeedback(el, 'pending')
					}
				}, 100)
			}
		}

		async function onPointerUp (e: PointerEvent) {
			const drag = dragRef.current
			if (!drag) return
			dragRef.current = null

			svg!.releasePointerCapture(drag.pointerId)
			if (drag.validateTimer) clearTimeout(drag.validateTimer)
			svg!.style.cursor = ''

			const pt = svgPoint(e)
			let newX = Math.round(((pt.x - drag.offsetX) / SCALE) * 10) / 10
			let newY = Math.round(((pt.y - drag.offsetY) / SCALE) * 10) / 10
			const v = vertsRef.current

			const snap = nearestEdge(newX, newY, v)
			let finalEdge: number | null = null
			if (snap.dist < EDGE_THRESHOLD) {
				finalEdge = snap.edgeIndex
				newX = Math.round(snap.snapX * 10) / 10
				newY = Math.round(snap.snapY * 10) / 10
				drag.isSideMount = true
			} else {
				drag.isSideMount = false
			}

			if (Math.abs(newX - drag.origX) < 0.2 && Math.abs(newY - drag.origY) < 0.2 && finalEdge === drag.edgeIndex) {
				drag.groupEl?.removeAttribute('transform')
				drag.groupEl!.style.cursor = 'grab'
				return
			}

			if (pendingAbortRef.current) pendingAbortRef.current.abort()
			if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
			const seq = ++commitSeqRef.current
			const abort = new AbortController()
			pendingAbortRef.current = abort

			const updated = { ...designRef.current }
			const ups = [...(updated.ui_placements ?? [])]
			const placementUpdate: UIPlacement = {
				...ups[drag.idx],
				x_mm: newX,
				y_mm: newY,
			}
			if (drag.isSideMount && finalEdge != null) {
				placementUpdate.edge_index = finalEdge
			} else {
				delete placementUpdate.edge_index
			}
			ups[drag.idx] = placementUpdate
			updated.ui_placements = ups

			drag.groupEl?.removeAttribute('transform')
			drag.groupEl!.style.cursor = 'grab'
			onDesignUpdateRef.current?.(updated)

			if (!sessionId) return

			try {
				const result = await validateUIPlacement(sessionId, {
					instance_id: drag.instanceId,
					x_mm: newX,
					y_mm: newY,
					...(drag.isSideMount && finalEdge != null ? { edge_index: finalEdge } : {}),
				})
				if (abort.signal.aborted) return
				if (!result.valid) {
					if (seq === commitSeqRef.current) {
						onDesignUpdateRef.current?.(designRef.current)
					}
					return
				}
			} catch {
				if (abort.signal.aborted) return
			}

			if (abort.signal.aborted) return
			persistTimerRef.current = setTimeout(async () => {
				if (abort.signal.aborted) return
				try {
					const latestDesign = designRef.current
					const stripped = stripEnrichment(latestDesign)
					const saved = await putDesign(sessionId, stripped)
					if (!abort.signal.aborted && seq === commitSeqRef.current) {
						onDesignUpdateRef.current?.(saved)
					}
					if (saved.invalidated_steps || saved.artifacts) {
						patchSession({
							invalidated_steps: saved.invalidated_steps,
							artifacts: saved.artifacts,
							pipeline_errors: saved.pipeline_errors,
						})
					}
					if (abort.signal.aborted || seq !== commitSeqRef.current) return
					await submitDesignToConversation(sessionId, stripped)
					if (!abort.signal.aborted && seq === commitSeqRef.current) {
						onDesignSubmittedRef.current?.()
					}
				} catch {
					/* optimistic update already applied */
				}
			}, 80)
		}

		svg.addEventListener('pointerdown', onPointerDown)
		svg.addEventListener('pointermove', onPointerMove)
		svg.addEventListener('pointerup', onPointerUp)
		return () => {
			svg.removeEventListener('pointerdown', onPointerDown)
			svg.removeEventListener('pointermove', onPointerMove)
			svg.removeEventListener('pointerup', onPointerUp)
		}
	}, [sessionId, svgEl]) // eslint-disable-line react-hooks/exhaustive-deps

	const bbox = outlineBBox(outline)
	const baseVbX = bbox.minX * SCALE - PAD
	const baseVbY = bbox.minY * SCALE - PAD
	const baseVbW = bbox.width * SCALE + PAD * 2
	const baseVbH = bbox.height * SCALE + PAD * 2

	const [vbState, setVbState] = useState({ x: baseVbX, y: baseVbY, w: baseVbW, h: baseVbH })

	// Reset viewBox when the outline geometry changes
	const outlineKey = `${bbox.minX},${bbox.minY},${bbox.width},${bbox.height}`
	const outlineKeyRef = useRef(outlineKey)
	useEffect(() => {
		if (outlineKeyRef.current !== outlineKey) {
			outlineKeyRef.current = outlineKey
			setVbState({ x: baseVbX, y: baseVbY, w: baseVbW, h: baseVbH })
		}
	}) // eslint-disable-line react-hooks/exhaustive-deps

	// Wheel zoom handler
	useEffect(() => {
		const svg = svgRef.current
		if (!svg) return
		function onWheel (e: WheelEvent) {
			e.preventDefault()
			const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1
			const rect = svg!.getBoundingClientRect()
			const fx = (e.clientX - rect.left) / rect.width
			const fy = (e.clientY - rect.top) / rect.height
			setVbState(prev => {
				const { x: bx, y: by, w: bw, h: bh } = bboxBaseRef.current
				const newW = Math.min(bw * 4, Math.max(10, prev.w * factor))
				const newH = Math.min(bh * 4, Math.max(10, prev.h * factor))
				const rawX = prev.x + fx * (prev.w - newW)
				const rawY = prev.y + fy * (prev.h - newH)
				return {
					x: Math.max(bx - bw, Math.min(bx + bw, rawX)),
					y: Math.max(by - bh, Math.min(by + bh, rawY)),
					w: newW, h: newH,
				}
			})
		}
		svg.addEventListener('wheel', onWheel, { passive: false })
		return () => { svg.removeEventListener('wheel', onWheel) }
	}, [svgEl]) // eslint-disable-line react-hooks/exhaustive-deps

	if (outline.length < 3) {
		return <div className="flex items-center justify-center text-fg-secondary text-sm p-8">No outline data</div>
	}

	// Keep bboxBaseRef current so the wheel effect can read it for clamping
	bboxBaseRef.current = { x: baseVbX, y: baseVbY, w: baseVbW, h: baseVbH }

	const vb = `${vbState.x} ${vbState.y} ${vbState.w} ${vbState.h}`
	const path = buildOutlinePath(outline, holes.length > 0 ? holes : undefined)

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
					ref={svgCallbackRef}
					viewBox={vb}
					className={className ?? 'w-full h-full'}
					xmlns="http://www.w3.org/2000/svg"
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
						width={baseVbW}
						height={baseVbH}
						fill="url(#grid10)"
					/>
					<path d={path} fill="rgba(86,114,160,0.06)" stroke="#5672a0" strokeWidth={2} fillRule="evenodd" />

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

						if (isSide) {
							const snapInfo = snapToEdge(p, verts, norm.zTops, design.enclosure?.height_mm ?? 25)
							return (
								<g
									key={p.instance_id}
									data-drag-idx={idx}
									style={{ cursor: 'grab' }}
								>
									{p.body ? (
										<ComponentIcon
											x={snapInfo.x}
											y={snapInfo.y}
											rotation={snapInfo.rot}
											body={p.body}
											pins={p.pins ?? []}
											label={p.instance_id}
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
								style={{ cursor: 'grab' }}
							>
								{p.body ? (
									<ComponentIcon
										x={p.x_mm}
										y={p.y_mm}
										body={p.body}
										pins={p.pins ?? []}
										label={p.instance_id}
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

export default memo(DesignViewport)

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
