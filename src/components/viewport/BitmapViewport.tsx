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

	const {
		nominal_bed_width, nominal_bed_depth,
		keepout_left, keepout_right, keepout_front, keepout_back,
		bed_width, bed_depth,
		bed_offset_x, bed_offset_y,
		bitmap_cols, bitmap_rows, bitmap_b64,
	} = bitmap
	const outline = normalizeOutline(bitmap.outline)
	const holes = normalizeHoles(bitmap.outline)
	const components = bitmap.components ?? []
	const traces = bitmap.traces ?? []
	const traceWidth = (bitmap.trace_width_mm ?? 0.3) * SCALE

	const uniqueNets = [...new Set(traces.map(t => t.net_id))]

	const bedScale = 2
	const svgW = nominal_bed_width * bedScale + 60
	const svgH = nominal_bed_depth * bedScale + 60
	const padX = 30
	const padY = 30

	const bedY = (y: number): number => padY + (nominal_bed_depth - y) * bedScale

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
				const canvasRow = bitmap_rows - 1 - r
				const idx = (canvasRow * bitmap_cols + c) * 4
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
			const cy = bedY(C[1] + bed_offset_y)
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
			const ay = bedY(C[1] + dPy * tIn + bed_offset_y)
			const bx = padX + (C[0] + dNx * tOut + bed_offset_x) * bedScale
			const by = bedY(C[1] + dNy * tOut + bed_offset_y)
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
				const cy = bedY(C[1] + bed_offset_y)
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
				const ay = bedY(C[1] + dPy * tIn + bed_offset_y)
				const bx = padX + (C[0] + dNx * tOut + bed_offset_x) * bedScale
				const by = bedY(C[1] + dNy * tOut + bed_offset_y)
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
				<span>{nominal_bed_width}{' × '}{nominal_bed_depth}{' mm bed'}</span>
			</div>

			<div className="flex-1 overflow-auto p-4 flex items-center justify-center">
				<svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
					<rect x={padX} y={padY} width={nominal_bed_width * bedScale} height={nominal_bed_depth * bedScale}
						fill="none" stroke="#d6d2ca" strokeWidth={1.5} strokeDasharray="8,4" />

					{(keepout_left > 0 || keepout_right > 0 || keepout_front > 0 || keepout_back > 0) && (
						<rect
							x={padX + keepout_left * bedScale}
							y={padY + keepout_back * bedScale}
							width={bed_width * bedScale}
							height={bed_depth * bedScale}
							fill="none" stroke="#358045" strokeWidth={1} strokeDasharray="4,3" opacity={0.5}
						/>
					)}

					<text x={padX + nominal_bed_width * bedScale / 2} y={padY - 8} textAnchor="middle" fontSize={10} fill="#6b6560">
						{'Build plate '}{nominal_bed_width}{' × '}{nominal_bed_depth}{' mm'}
					</text>

					{outlinePathD && (
						<path
							d={outlinePathD}
							fillRule="evenodd"
							fill="rgba(86,114,160,0.08)" stroke="#5672a0" strokeWidth={1.5}
						/>
					)}

					{components.map(c => {
						const compH = (c.body?.length_mm ?? 4)
						return (
							<rect
								key={c.instance_id}
								x={padX + (c.x_mm + bed_offset_x - (c.body?.width_mm ?? 4) / 2) * bedScale}
								y={bedY(c.y_mm + bed_offset_y + compH / 2)}
								width={(c.body?.width_mm ?? 4) * bedScale}
								height={compH * bedScale}
								fill="rgba(86,114,160,0.2)" stroke="#5672a0" strokeWidth={0.8}
							/>
						)
					})}

					{traces.map((trace, i) => {
						const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
						return (
							<polyline
								key={i}
								points={trace.path.map(([x, y]) =>
									`${padX + (x + bed_offset_x) * bedScale},${bedY(y + bed_offset_y)}`
								).join(' ')}
								fill="none" stroke={color} strokeWidth={traceWidth / SCALE * bedScale}
								opacity={0.4} strokeLinecap="round"
							/>
						)
					})}

					{showBitmap && bitmap_b64 && (
						<foreignObject
							x={padX}
							y={padY}
							width={nominal_bed_width * bedScale}
							height={nominal_bed_depth * bedScale}
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
