'use client'

import type { ReactElement } from 'react'

import { SCALE } from '@/lib/viewport'
import type { CatalogBody, CatalogPin } from '@/types/models'

interface Props {
	x: number
	y: number
	rotation?: number
	body: CatalogBody
	pins: CatalogPin[]
	label?: string
	dimmed?: boolean
	highlight?: boolean
}

export default function ComponentIcon ({ x, y, rotation = 0, body, pins, label, dimmed, highlight }: Props): ReactElement {
	const cx = x * SCALE
	const cy = y * SCALE
	const opacity = dimmed ? 0.3 : 1

	const bodyFill = highlight ? 'rgba(86,114,160,0.15)' : 'rgba(61,58,54,0.08)'
	const bodyStroke = highlight ? '#5672a0' : '#6b6560'

	return (
		<g transform={`translate(${cx},${cy}) rotate(${rotation})`} opacity={opacity}>
			{body.shape === 'circle' ? (
				<circle
					r={(body.diameter_mm ?? 5) / 2 * SCALE}
					fill={bodyFill}
					stroke={bodyStroke}
					strokeWidth={1.2}
				/>
			) : (
				<rect
					x={-(body.width_mm ?? 5) / 2 * SCALE}
					y={-(body.length_mm ?? 5) / 2 * SCALE}
					width={(body.width_mm ?? 5) * SCALE}
					height={(body.length_mm ?? 5) * SCALE}
					rx={1}
					fill={bodyFill}
					stroke={bodyStroke}
					strokeWidth={1.2}
				/>
			)}

			{body.shape === 'circle' && body.diameter_mm && (
				<line
					x1={-(body.diameter_mm / 2) * SCALE}
					y1={0}
					x2={-(body.diameter_mm / 2 - 0.8) * SCALE}
					y2={0}
					stroke={bodyStroke}
					strokeWidth={2}
				/>
			)}

			{pins.length > 4 && body.shape === 'rect' && (
				<circle
					cx={-(body.width_mm ?? 5) / 2 * SCALE + 3}
					cy={-(body.length_mm ?? 5) / 2 * SCALE + 3}
					r={2}
					fill={bodyStroke}
					opacity={0.6}
				/>
			)}

			{pins.map(pin => {
				const px = pin.position_mm[0] * SCALE
				const py = pin.position_mm[1] * SCALE
				const color = pin.direction === 'in' ? '#5672a0' : pin.direction === 'out' ? '#b05050' : '#d4b462'
				return (
					<g key={pin.id}>
						<circle cx={px} cy={py} r={2.5} fill={color} />
						{pins.length <= 6 && (
							<text
								x={px}
								y={py - 5}
								textAnchor="middle"
								fontSize={7}
								fill="#6b6560"
							>
								{pin.id}
							</text>
						)}
					</g>
				)
			})}

			{label && (
				<text
					y={(body.shape === 'circle'
						? (body.diameter_mm ?? 5) / 2
						: (body.length_mm ?? 5) / 2) * SCALE + 12}
					textAnchor="middle"
					fontSize={8}
					fill="#6b6560"
				>
					{label}
				</text>
			)}
		</g>
	)
}
