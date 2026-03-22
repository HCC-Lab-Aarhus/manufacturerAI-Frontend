'use client'

import { type ReactElement, useEffect, useRef, useState } from 'react'

import { SCALE, netColor, normalizeOutline, normalizeHoles, normaliseOutline } from '@/lib/viewport'
import type { BitmapResult } from '@/types/models'

interface Props {
	bitmap: BitmapResult
	className?: string
}

export default function BitmapViewport ({ bitmap, className }: Props): ReactElement {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [showBitmap, setShowBitmap] = useState(true)

	const { bed_width, bed_depth, bed_offset_x, bed_offset_y, bitmap_cols, bitmap_rows, bitmap_b64 } = bitmap
	const outline = normalizeOutline(bitmap.outline)
	const holes = normalizeHoles(bitmap.outline)
	const components = bitmap.components ?? []
	const traces = bitmap.traces ?? []
	const traceWidth = (bitmap.trace_width_mm ?? 0.3) * SCALE

	const uniqueNets = [...new Set(traces.map(t => t.net_id))]

	const bedScale = 2
	const svgW = bed_width * bedScale + 60
	const svgH = bed_depth * bedScale + 60
	const padX = 30
	const padY = 30

	useEffect(() => {
		if (!canvasRef.current || !bitmap_b64 || !showBitmap) { return }
		const canvas = canvasRef.current
		canvas.width = bitmap_cols
		canvas.height = bitmap_rows
		const ctx = canvas.getContext('2d')
		if (!ctx) { return }

		const raw = atob(bitmap_b64)
		const byteCols = Math.ceil(bitmap_cols / 8)
		const imgData = ctx.createImageData(bitmap_cols, bitmap_rows)

		for (let r = 0; r < bitmap_rows; r++) {
			for (let c = 0; c < bitmap_cols; c++) {
				const byteIdx = r * byteCols + Math.floor(c / 8)
				const bitIdx = 7 - (c % 8)
				const on = (raw.charCodeAt(byteIdx) >> bitIdx) & 1
				const idx = (r * bitmap_cols + c) * 4
				if (on) {
					imgData.data[idx] = 53
					imgData.data[idx + 1] = 128
					imgData.data[idx + 2] = 69
					imgData.data[idx + 3] = 200
				}
			}
		}
		ctx.putImageData(imgData, 0, 0)
	}, [bitmap_b64, bitmap_cols, bitmap_rows, showBitmap])

	const outlinePts = outline.map(p => [p.x, p.y])
	const minX = outlinePts.length > 0 ? Math.min(...outlinePts.map(p => p[0])) : 0
	const minY = outlinePts.length > 0 ? Math.min(...outlinePts.map(p => p[1])) : 0
	const maxX = outlinePts.length > 0 ? Math.max(...outlinePts.map(p => p[0])) : 0
	const maxY = outlinePts.length > 0 ? Math.max(...outlinePts.map(p => p[1])) : 0
	const partW = maxX - minX
	const partH = maxY - minY

	// Build Bézier-expanded outline path matching other viewports
	const outlinePathD = (() => {
		const norm = normaliseOutline(outline)
		const { verts, corners } = norm
		const n = verts.length
		if (n < 3) return ''
		const parts: string[] = []
		for (let i = 0; i < n; i++) {
			const C = verts[i]
			const prev = (i - 1 + n) % n
			const next = (i + 1) % n
			const P = verts[prev], N = verts[next]
			const eIn = corners[i].ease_in ?? 0
			const eOut = corners[i].ease_out ?? 0
			const cx = padX + (C[0] + bed_offset_x) * bedScale
			const cy = padY + (C[1] + bed_offset_y) * bedScale
			if (eIn === 0 && eOut === 0) {
				parts.push(i === 0 ? `M${cx},${cy}` : `L${cx},${cy}`)
				continue
			}
			const dPx = P[0] - C[0], dPy = P[1] - C[1]
			const dNx = N[0] - C[0], dNy = N[1] - C[1]
			const lenP = Math.hypot(dPx, dPy)
			const lenN = Math.hypot(dNx, dNy)
			const tIn = Math.min(eIn / lenP, 0.5)
			const tOut = Math.min(eOut / lenN, 0.5)
			const ax = padX + (C[0] + dPx * tIn + bed_offset_x) * bedScale
			const ay = padY + (C[1] + dPy * tIn + bed_offset_y) * bedScale
			const bx = padX + (C[0] + dNx * tOut + bed_offset_x) * bedScale
			const by = padY + (C[1] + dNy * tOut + bed_offset_y) * bedScale
			if (i === 0) parts.push(`M${ax},${ay}`)
			else parts.push(`L${ax},${ay}`)
			parts.push(`Q${cx},${cy} ${bx},${by}`)
		}
		parts.push('Z')

		for (const hole of holes) {
			const hn = normaliseOutline(hole)
			const hv = hn.verts, hc = hn.corners
			if (hv.length < 3) continue
			for (let j = 0; j < hv.length; j++) {
				const C = hv[j]
				const prev = (j - 1 + hv.length) % hv.length
				const next = (j + 1) % hv.length
				const P = hv[prev], N = hv[next]
				const eIn = hc[j].ease_in ?? 0
				const eOut = hc[j].ease_out ?? 0
				const cx = padX + (C[0] + bed_offset_x) * bedScale
				const cy = padY + (C[1] + bed_offset_y) * bedScale
				if (eIn === 0 && eOut === 0) {
					parts.push(j === 0 ? `M${cx},${cy}` : `L${cx},${cy}`)
					continue
				}
				const dPx = P[0] - C[0], dPy = P[1] - C[1]
				const dNx = N[0] - C[0], dNy = N[1] - C[1]
				const lenP = Math.hypot(dPx, dPy)
				const lenN = Math.hypot(dNx, dNy)
				const tIn = Math.min(eIn / lenP, 0.5)
				const tOut = Math.min(eOut / lenN, 0.5)
				const ax = padX + (C[0] + dPx * tIn + bed_offset_x) * bedScale
				const ay = padY + (C[1] + dPy * tIn + bed_offset_y) * bedScale
				const bx = padX + (C[0] + dNx * tOut + bed_offset_x) * bedScale
				const by = padY + (C[1] + dNy * tOut + bed_offset_y) * bedScale
				if (j === 0) parts.push(`M${ax},${ay}`)
				else parts.push(`L${ax},${ay}`)
				parts.push(`Q${cx},${cy} ${bx},${by}`)
			}
			parts.push('Z')
		}

		return parts.join(' ')
	})()

	return (
		<div className={className ?? 'w-full h-full flex flex-col'}>
			<div className="flex items-center gap-4 px-3 py-1.5 text-xs text-fg-secondary border-b border-border">
				<label className="flex items-center gap-1.5">
					<input type="checkbox" checked={showBitmap} onChange={e => setShowBitmap(e.target.checked)} className="accent-success" />
					{'Show bitmap overlay'}
				</label>
				<span>{bitmap_cols}{' × '}{bitmap_rows}{' px'}</span>
				<span>{bed_width}{' × '}{bed_depth}{' mm bed'}</span>
			</div>

			<div className="flex-1 overflow-auto p-4 flex items-center justify-center">
				<svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
					<rect x={padX} y={padY} width={bed_width * bedScale} height={bed_depth * bedScale}
						fill="none" stroke="#d6d2ca" strokeWidth={1.5} strokeDasharray="8,4" />

					<text x={padX + bed_width * bedScale / 2} y={padY - 8} textAnchor="middle" fontSize={10} fill="#6b6560">
						{'Build plate '}{bed_width}{' × '}{bed_depth}{' mm'}
					</text>

					{outlinePathD && (
						<path
							d={outlinePathD}
							fillRule="evenodd"
							fill="rgba(86,114,160,0.08)" stroke="#5672a0" strokeWidth={1.5}
						/>
					)}

					{components.map(c => (
						<rect
							key={c.instance_id}
							x={padX + (c.x_mm + bed_offset_x - (c.body?.width_mm ?? 4) / 2) * bedScale}
							y={padY + (c.y_mm + bed_offset_y - (c.body?.length_mm ?? 4) / 2) * bedScale}
							width={(c.body?.width_mm ?? 4) * bedScale}
							height={(c.body?.length_mm ?? 4) * bedScale}
							fill="rgba(86,114,160,0.2)" stroke="#5672a0" strokeWidth={0.8}
						/>
					))}

					{traces.map((trace, i) => {
						const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
						return (
							<polyline
								key={i}
								points={trace.path.map(([x, y]) =>
									`${padX + (x + bed_offset_x) * bedScale},${padY + (y + bed_offset_y) * bedScale}`
								).join(' ')}
								fill="none" stroke={color} strokeWidth={traceWidth / SCALE * bedScale}
								opacity={0.4} strokeLinecap="round"
							/>
						)
					})}

					{showBitmap && bitmap_b64 && (
						<foreignObject
							x={padX + bed_offset_x * bedScale + (minX) * bedScale}
							y={padY + bed_offset_y * bedScale + (minY) * bedScale}
							width={partW * bedScale}
							height={partH * bedScale}
						>
							<canvas
								ref={canvasRef}
								className="size-full [image-rendering:pixelated]"
							/>
						</foreignObject>
					)}
				</svg>
			</div>
		</div>
	)
}
