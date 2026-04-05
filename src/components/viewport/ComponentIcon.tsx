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
	dragValid?: 'valid' | 'invalid' | 'pending' | null
}

const DRAG_FILLS: Record<string, { fill: string; stroke: string }> = {
	valid:   { fill: 'var(--color-drag-valid-fill)', stroke: 'var(--color-drag-valid)' },
	invalid: { fill: 'var(--color-drag-invalid-fill)', stroke: 'var(--color-drag-invalid)' },
	pending: { fill: 'var(--color-drag-pending-fill)', stroke: 'var(--color-drag-pending)' },
}

export default function ComponentIcon ({ x, y, rotation = 0, body, pins, label, dimmed, highlight, dragValid }: Props): ReactElement {
	const cx = x * SCALE
	const cy = y * SCALE
	const opacity = dimmed ? 0.3 : 1

	const dv = dragValid ? DRAG_FILLS[dragValid] : null
	const bodyFill = dv?.fill ?? (highlight ? 'var(--color-body-fill-hl)' : 'var(--color-body-fill)')
	const bodyStroke = dv?.stroke ?? (highlight ? 'var(--color-body-stroke-hl)' : 'var(--color-body-stroke)')

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
				const color = pin.direction === 'in' ? 'var(--color-pin-input)' : pin.direction === 'out' ? 'var(--color-pin-output)' : 'var(--color-pin-bidir)'
				const isRect = pin.shape?.type === 'rect' && pin.shape.width_mm && pin.shape.length_mm
				const MIN_PIN_PX = 5
				return (
					<g key={pin.id}>
						{isRect ? (
							<rect
								x={px - Math.max(pin.shape!.width_mm! * SCALE, MIN_PIN_PX) / 2}
								y={py - Math.max(pin.shape!.length_mm! * SCALE, MIN_PIN_PX) / 2}
								width={Math.max(pin.shape!.width_mm! * SCALE, MIN_PIN_PX)}
								height={Math.max(pin.shape!.length_mm! * SCALE, MIN_PIN_PX)}
								fill={color}
							/>
						) : (
							<circle cx={px} cy={py} r={Math.max(pin.hole_diameter_mm / 2 * SCALE, MIN_PIN_PX / 2)} fill={color} />
						)}
						{pins.length <= 6 && (
							<text
								x={px}
								y={py - 5}
								textAnchor="middle"
								fontSize={7}
								fill="var(--color-label)"
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
					fill="var(--color-label)"
				>
					{label}
				</text>
			)}
		</g>
	)
}
