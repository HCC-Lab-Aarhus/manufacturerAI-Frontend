'use client'

import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useTheme } from '@/contexts/ThemeContext'
import { DEFAULT_COLOR } from '@/lib/theme'

function hexToHsb (hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const d = max - min
	let h = 0
	if (d !== 0) {
		if (max === r) h = ((g - b) / d + 6) % 6
		else if (max === g) h = (b - r) / d + 2
		else h = (r - g) / d + 4
		h *= 60
	}
	const s = max === 0 ? 0 : d / max
	return [h, s, max]
}

function hsbToHex (h: number, s: number, b: number): string {
	const c = b * s
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
	const m = b - c
	let r = 0, g = 0, bl = 0
	if (h < 60) { r = c; g = x }
	else if (h < 120) { r = x; g = c }
	else if (h < 180) { g = c; bl = x }
	else if (h < 240) { g = x; bl = c }
	else if (h < 300) { r = x; bl = c }
	else { r = c; bl = x }
	const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
	return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

const WHEEL_SIZE = 56
const WHEEL_R = WHEEL_SIZE / 2
const RING_WIDTH = 8
const LOG_EXP = 2

function toSliderPos (value: number): number {
	return Math.pow(Math.max(0, Math.min(1, value)), 1 / LOG_EXP)
}

function fromSliderPos (pos: number): number {
	return Math.pow(Math.max(0, Math.min(1, pos)), LOG_EXP)
}

function logGradient (steps: number, colorFn: (v: number) => string): string {
	const parts = Array.from({ length: steps }, (_, i) => {
		const pos = i / (steps - 1)
		const val = fromSliderPos(pos)
		return `${colorFn(val)} ${(pos * 100).toFixed(1)}%`
	})
	return `linear-gradient(to right, ${parts.join(', ')})`
}

function HueWheel ({ hue, sat, bri, onChange }: {
	hue: number
	sat: number
	bri: number
	onChange: (h: number) => void
}): ReactElement {
	const dragRef = useRef<{ startX: number; startHue: number } | null>(null)

	const stops = useMemo(() =>
		Array.from({ length: 13 }, (_, i) => {
			const deg = i * 30
			return `${hsbToHex(deg, sat, bri)} ${deg}deg`
		}),
	[sat, bri])

	const onPointerDown = useCallback((e: React.PointerEvent) => {
		e.currentTarget.setPointerCapture(e.pointerId)
		dragRef.current = { startX: e.clientX, startHue: hue }
	}, [hue])

	const onPointerMove = useCallback((e: React.PointerEvent) => {
		if (!dragRef.current) return
		const dx = e.clientX - dragRef.current.startX
		const newH = (dragRef.current.startHue + dx * 0.5 + 3600) % 360
		onChange(newH)
	}, [onChange])

	const onPointerUp = useCallback(() => {
		dragRef.current = null
	}, [])

	return (
		<div
			className="relative shrink-0 cursor-ew-resize touch-none select-none"
			style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
		>
			<div
				className="absolute inset-0 rounded-full"
				style={{
					background: `conic-gradient(from 0deg, ${stops.join(', ')})`,
					mask: `radial-gradient(circle, transparent ${WHEEL_R - RING_WIDTH}px, black ${WHEEL_R - RING_WIDTH}px)`,
					WebkitMask: `radial-gradient(circle, transparent ${WHEEL_R - RING_WIDTH}px, black ${WHEEL_R - RING_WIDTH}px)`,
				}}
			/>
			<div
				className="absolute left-1/2 -translate-x-1/2"
				style={{
					top: 1,
					width: 4,
					height: RING_WIDTH - 2,
					transformOrigin: `50% ${WHEEL_R - 1}px`,
					transform: `rotate(${hue}deg)`,
				}}
			>
				<div className="w-full h-full rounded-sm bg-white shadow-[0_0_2px_rgba(0,0,0,0.7)]" />
			</div>
			<div
				className="absolute rounded-full border border-border/40"
				style={{
					top: RING_WIDTH + 2,
					left: RING_WIDTH + 2,
					right: RING_WIDTH + 2,
					bottom: RING_WIDTH + 2,
					backgroundColor: hsbToHex(hue, sat, bri),
				}}
			/>
		</div>
	)
}

function HsbSlider ({ label, value, background, onChange, onInvert }: {
	label: string
	value: number
	background: string
	onChange: (v: number) => void
	onInvert: () => void
}): ReactElement {
	return (
		<div className="flex items-center gap-1.5">
			<span className="text-[10px] text-fg-muted w-3 shrink-0">{label}</span>
			<div className="relative flex-1 h-3 rounded-full overflow-hidden">
				<div className="absolute inset-0 rounded-full" style={{ background }} />
				<input
					type="range"
					min={0}
					max={1}
					step={0.005}
					value={toSliderPos(value)}
					onChange={e => onChange(fromSliderPos(Number(e.target.value)))}
					className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer
						[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
						[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
						[&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_2px_rgba(0,0,0,0.6)]
						[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
						[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent
						[&::-moz-range-thumb]:shadow-[0_0_2px_rgba(0,0,0,0.6)]
						[&::-moz-range-track]:bg-transparent"
					title={label}
				/>
			</div>
			<button
				onClick={onInvert}
				className="text-[10px] text-fg-muted/50 hover:text-fg-secondary transition-colors shrink-0 w-4 text-center"
				title={`Invert ${label}`}
			>
				{'⇄'}
			</button>
		</div>
	)
}

export default function ColorPicker (): ReactElement {
	const { color, setColor } = useTheme()
	const [h, setH] = useState(() => hexToHsb(color)[0])
	const [s, setS] = useState(() => hexToHsb(color)[1])
	const [b, setB] = useState(() => hexToHsb(color)[2])
	const lastInternalHex = useRef(color)

	useEffect(() => {
		if (lastInternalHex.current === color) return
		const [nh, ns, nb] = hexToHsb(color)
		setH(nh)
		setS(ns)
		setB(nb)
	}, [color])

	const applyHsb = useCallback((nh: number, ns: number, nb: number) => {
		setH(nh)
		setS(ns)
		setB(nb)
		const hex = hsbToHex(nh, ns, nb)
		lastInternalHex.current = hex
		setColor(hex)
	}, [setColor])

	const satGradient = useMemo(() =>
		logGradient(11, v => hsbToHex(h, v, b)),
	[h, b])

	const briGradient = useMemo(() =>
		logGradient(11, v => hsbToHex(h, s, v)),
	[h, s])

	const handleReset = useCallback(() => {
		const [nh, ns, nb] = hexToHsb(DEFAULT_COLOR)
		setH(nh)
		setS(ns)
		setB(nb)
		lastInternalHex.current = DEFAULT_COLOR
		setColor(DEFAULT_COLOR)
	}, [setColor])

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<span className="text-xs text-fg-muted">Theme</span>
				{color !== DEFAULT_COLOR && (
					<button
						onClick={handleReset}
						className="ml-auto text-xs text-fg-muted hover:text-fg-secondary transition-colors"
						title="Reset to default"
					>
						Reset
					</button>
				)}
			</div>
			<div className="flex items-center gap-3">
				<HueWheel hue={h} sat={s} bri={b} onChange={v => applyHsb(v, s, b)} />
				<div className="flex flex-col gap-1.5 flex-1 min-w-0">
					<HsbSlider
						label="S" value={s} background={satGradient}
						onChange={v => applyHsb(h, v, b)}
						onInvert={() => applyHsb(h, fromSliderPos(1 - toSliderPos(s)), b)}
					/>
					<HsbSlider
						label="B" value={b} background={briGradient}
						onChange={v => applyHsb(h, s, v)}
						onInvert={() => applyHsb(h, s, fromSliderPos(1 - toSliderPos(b)))}
					/>
				</div>
			</div>
		</div>
	)
}
