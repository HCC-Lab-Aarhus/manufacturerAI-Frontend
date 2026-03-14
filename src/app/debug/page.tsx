'use client'

import Link from 'next/link'
import { type ReactElement, useEffect, useState } from 'react'

import { listPrinters, listFilaments, generateCalibration } from '@/lib/api'
import type { Printer, Filament } from '@/types/models'

export default function DebugPage (): ReactElement {
	const [printers, setPrinters] = useState<Printer[]>([])
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [printer, setPrinter] = useState('')
	const [filament, setFilament] = useState('')
	const [bedWidth, setBedWidth] = useState(219)
	const [bedDepth, setBedDepth] = useState(219)
	const [boxSize, setBoxSize] = useState(100)
	const [padding, setPadding] = useState(5)
	const [squareSize, setSquareSize] = useState(5)
	const [generating, setGenerating] = useState(false)
	const [error, setError] = useState('')
	const [gcodeUrl, setGcodeUrl] = useState<string | null>(null)
	const [bitmapUrl, setBitmapUrl] = useState<string | null>(null)

	useEffect(() => {
		listPrinters().then(p => { setPrinters(p); if (p.length) { setPrinter(p[0].id) } }).catch(() => {})
		listFilaments().then(f => { setFilaments(f); if (f.length) { setFilament(f[0].id) } }).catch(() => {})
	}, [])

	const handleGenerate = async () => {
		setGenerating(true)
		setError('')
		setGcodeUrl(null)
		setBitmapUrl(null)
		try {
			const data = await generateCalibration({
				printer, filament, bed_width: bedWidth, bed_depth: bedDepth,
				box_size: boxSize, padding, square_size: squareSize
			})
			setGcodeUrl(URL.createObjectURL(new Blob([data.gcode], { type: 'text/plain' })))
			setBitmapUrl(URL.createObjectURL(new Blob([data.bitmap], { type: 'text/plain' })))
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Generation failed')
		} finally {
			setGenerating(false)
		}
	}

	const field = (label: string, value: number, onChange: (v: number) => void, step = 1) => (
		<div className="flex items-center justify-between gap-4">
			<label className="text-sm text-fg-secondary">{label}</label>
			<input
				type="number"
				value={value}
				step={step}
				title={label}
				onChange={e => onChange(Number(e.target.value))}
				className="w-24 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg"
			/>
		</div>
	)

	return (
		<div className="flex h-screen items-start justify-center bg-surface p-8">
			<div className="w-full max-w-md space-y-6">
				<div>
					<h1 className="text-xl font-semibold text-fg">{'Calibration Generator'}</h1>
					<p className="mt-1 text-sm text-fg-muted">{'Generates 4 physical and projected squares to calibrate alignment.'}</p>
				</div>

				<div className="rounded-2xl bg-surface-card p-6 shadow-sm space-y-4">
					<div className="flex items-center justify-between gap-4">
						<label className="text-sm text-fg-secondary">{'Printer'}</label>
						<select value={printer} onChange={e => setPrinter(e.target.value)} title="Printer" className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
							{printers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
						</select>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label className="text-sm text-fg-secondary">{'Filament'}</label>
						<select value={filament} onChange={e => setFilament(e.target.value)} title="Filament" className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
							{filaments.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
						</select>
					</div>
					{field('Bed Width (mm)', bedWidth, setBedWidth)}
					{field('Bed Depth (mm)', bedDepth, setBedDepth)}
					{field('Bounding Box (mm)', boxSize, setBoxSize)}
					{field('Padding (mm)', padding, setPadding, 0.5)}
					{field('Square Size (mm)', squareSize, setSquareSize, 0.5)}

					<button
						onClick={handleGenerate}
						disabled={generating}
						className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
					>
						{generating ? 'Generating…' : 'Generate Calibration Files'}
					</button>

					{error && <p className="text-sm text-danger text-center">{error}</p>}

					{(gcodeUrl || bitmapUrl) && (
						<div className="flex gap-3 pt-2">
							{gcodeUrl && (
								<a href={gcodeUrl} download="debug_calibration.gcode" className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
									{'Download G-code'}
								</a>
							)}
							{bitmapUrl && (
								<a href={bitmapUrl} download="trace_bitmap.txt" className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
									{'Download Bitmap'}
								</a>
							)}
						</div>
					)}
				</div>

				<Link href="/" className="inline-block text-sm text-accent hover:underline">{'← Back to main'}</Link>
			</div>
		</div>
	)
}
