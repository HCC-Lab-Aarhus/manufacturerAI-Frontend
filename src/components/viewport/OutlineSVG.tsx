'use client'

import type { ReactElement } from 'react'

import { buildOutlinePath, svgViewBox, SCALE, PAD } from '@/lib/viewport'
import type { OutlineVertex } from '@/types/models'

interface Props {
	outline: OutlineVertex[]
	holes?: OutlineVertex[][]
	pcbContour?: [number, number][] | null
	children?: React.ReactNode
	className?: string
}

export default function OutlineSVG ({ outline, holes, pcbContour, children, className }: Props): ReactElement {
	if (!outline || outline.length < 3) {
		return <div className="flex items-center justify-center text-fg-secondary text-sm p-8">{'No outline data'}</div>
	}

	const vb = svgViewBox(outline)
	const path = buildOutlinePath(outline, holes && holes.length > 0 ? holes : undefined)

	const xs = outline.map(p => p.x)
	const ys = outline.map(p => p.y)
	const minX = Math.min(...xs)
	const minY = Math.min(...ys)
	const width = Math.max(...xs) - minX
	const height = Math.max(...ys) - minY

	return (
		<svg viewBox={vb} className={className ?? 'w-full h-full'} xmlns="http://www.w3.org/2000/svg">
			<defs>
				<pattern id="grid10" width={10 * SCALE} height={10 * SCALE} patternUnits="userSpaceOnUse">
					<line x1={0} y1={0} x2={0} y2={10 * SCALE} stroke="var(--color-grid)" strokeWidth={0.5} />
					<line x1={0} y1={0} x2={10 * SCALE} y2={0} stroke="var(--color-grid)" strokeWidth={0.5} />
				</pattern>
			</defs>

			<rect
				x={minX * SCALE - PAD}
				y={minY * SCALE - PAD}
				width={width * SCALE + PAD * 2}
				height={height * SCALE + PAD * 2}
				fill="url(#grid10)"
			/>

			<path d={path} fill="var(--color-outline-fill)" stroke="var(--color-outline-stroke)" strokeWidth={2} fillRule="evenodd" />

			{pcbContour && pcbContour.length > 2 && (
				<polyline
					points={pcbContour.map(([x, y]) => `${x * SCALE},${y * SCALE}`).join(' ')}
					fill="none"
					stroke="var(--color-pcb-stroke)"
					strokeWidth={1.5}
					strokeDasharray="6,3"
					opacity={0.7}
				/>
			)}

			<text x={minX * SCALE + width * SCALE / 2} y={minY * SCALE - PAD / 2} textAnchor="middle" fontSize={10} fill="var(--color-label)">
				{width.toFixed(1)}{' mm'}
			</text>
			<text
				x={minX * SCALE - PAD / 2}
				y={minY * SCALE + height * SCALE / 2}
				textAnchor="middle"
				fontSize={10}
				fill="var(--color-label)"
				transform={`rotate(-90, ${minX * SCALE - PAD / 2}, ${minY * SCALE + height * SCALE / 2})`}
			>
				{height.toFixed(1)}{' mm'}
			</text>

			{children}
		</svg>
	)
}
