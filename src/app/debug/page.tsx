'use client'

import Link from 'next/link'
import { type ReactElement, useEffect, useState } from 'react'

import { listPrinters, listFilaments, generateCalibration, generateSilverinkTest } from '@/lib/api'
import type { Printer, Filament } from '@/types/models'

type TestMode = 'calibration' | 'silverink'

export default function DebugPage (): ReactElement {
	const [printers, setPrinters] = useState<Printer[]>([])
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [printer, setPrinter] = useState('')
	const [filament, setFilament] = useState('')
	const [testMode, setTestMode] = useState<TestMode>('calibration')

	// Shared params
	const [boxSize, setBoxSize] = useState(100)
	const [padding, setPadding] = useState(5)

	// Calibration-specific
	const [squareSize, setSquareSize] = useState(5)

	// Silverink test-specific
	const [rectWidth, setRectWidth] = useState(10)
	const [rectHeight, setRectHeight] = useState(20)
	const [layers, setLayers] = useState(4)

	const [generating, setGenerating] = useState(false)
	const [error, setError] = useState('')
	const [gcodeUrl, setGcodeUrl] = useState<string | null>(null)
	const [bitmapUrl, setBitmapUrl] = useState<string | null>(null)
	const [contractUrl, setContractUrl] = useState<string | null>(null)
	const [gcodeFilename, setGcodeFilename] = useState('calibration.gcode')
	const [bitmapFilename, setBitmapFilename] = useState('calibration_bitmap.txt')

	const selectedPrinter = printers.find(p => p.id === printer)

	useEffect(() => {
		listPrinters().then(p => {
			setPrinters(p)
			if (p.length) {
				setPrinter(p[0].id)
			}
		}).catch(() => {})
		listFilaments().then(f => { setFilaments(f); if (f.length) { setFilament(f[0].id) } }).catch(() => {})
	}, [])

	const handlePrinterChange = (id: string) => {
		setPrinter(id)
	}

	const clearDownloads = () => {
		setGcodeUrl(null)
		setBitmapUrl(null)
		setContractUrl(null)
	}

	const handleGenerate = async () => {
		setGenerating(true)
		setError('')
		clearDownloads()
		try {
			const data = testMode === 'calibration'
				? await generateCalibration({
					printer, filament,
					box_size: boxSize, padding, square_size: squareSize
				})
				: await generateSilverinkTest({
					printer, filament,
					padding,
					rect_width: rectWidth, rect_height: rectHeight, layers
				})
			setGcodeFilename(String(data.contract.gcode_file || `${testMode}.gcode`))
			setBitmapFilename(String(data.contract.bitmap_file || `${testMode}_bitmap.txt`))
			setGcodeUrl(URL.createObjectURL(new Blob([data.gcode], { type: 'text/plain' })))
			setBitmapUrl(URL.createObjectURL(new Blob([data.bitmap], { type: 'text/plain' })))
			setContractUrl(URL.createObjectURL(new Blob([JSON.stringify(data.contract, null, 2)], { type: 'application/json' })))
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

	const titles: Record<TestMode, { heading: string; description: string }> = {
		calibration: {
			heading: 'Calibration Generator',
			description: 'Generates alignment squares to calibrate inkjet-to-PLA offset.'
		},
		silverink: {
			heading: 'Silverink Test Generator',
			description: 'Generates ironed rectangles with silver traces to test ink adhesion and conductivity.'
		}
	}

	return (
		<div className="flex h-screen items-start justify-center bg-surface p-8">
			<Link href="/" className="absolute left-4 top-4 text-sm text-accent hover:underline">{'← Back to main'}</Link>
			<div className="w-full max-w-md space-y-6">
				<div>
					<h1 className="text-xl font-semibold text-fg">{titles[testMode].heading}</h1>
					<p className="mt-1 text-sm text-fg-muted">{titles[testMode].description}</p>
				</div>

				{/* Test mode selector */}
				<div className="flex rounded-xl bg-surface-card p-1 shadow-sm">
					{(['calibration', 'silverink'] as const).map(mode => (
						<button
							key={mode}
							onClick={() => { setTestMode(mode); clearDownloads() }}
							className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
								testMode === mode
									? 'bg-accent text-white'
									: 'text-fg-secondary hover:text-fg'
							}`}
						>
							{mode === 'calibration' ? 'Calibration' : 'Silverink Test'}
						</button>
					))}
				</div>

				{selectedPrinter && (
					<div className="rounded-2xl bg-surface-card p-4 shadow-sm space-y-2">
						<h2 className="text-sm font-medium text-fg">{'Inkjet Offset'}</h2>
						<div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-fg-secondary">
							<span>{'Nominal bed'}</span>
							<span className="text-fg">{selectedPrinter.nominal_bed_width} {'×'} {selectedPrinter.nominal_bed_depth} {'mm'}</span>
							<span>{'Usable area'}</span>
							<span className="text-fg">{selectedPrinter.bed_width} {'×'} {selectedPrinter.bed_depth} {'mm'}</span>
							<span>{'Offset X'}</span>
							<span className="text-fg">{selectedPrinter.inkjet_offset_x} {'mm'}</span>
							<span>{'Offset Y'}</span>
							<span className="text-fg">{selectedPrinter.inkjet_offset_y} {'mm'}</span>
						</div>
					</div>
				)}

				<div className="rounded-2xl bg-surface-card p-6 shadow-sm space-y-4">
					<div className="flex items-center justify-between gap-4">
						<label className="text-sm text-fg-secondary">{'Printer'}</label>
						<select value={printer} onChange={e => handlePrinterChange(e.target.value)} title="Printer" className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
							{printers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
						</select>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label className="text-sm text-fg-secondary">{'Filament'}</label>
						<select value={filament} onChange={e => setFilament(e.target.value)} title="Filament" className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
							{filaments.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
						</select>
					</div>
					{field('Padding (mm)', padding, setPadding, 0.5)}

					{testMode === 'calibration' && (
						<>
							{field('Bounding Box (mm)', boxSize, setBoxSize)}
							{field('Square Size (mm)', squareSize, setSquareSize, 0.5)}
						</>
					)}

					{testMode === 'silverink' && (
						<>
							{field('Rectangle Width (mm)', rectWidth, setRectWidth, 1)}
							{field('Rectangle Height (mm)', rectHeight, setRectHeight, 1)}
							{field('Layers', layers, setLayers)}
						</>
					)}

					<button
						onClick={handleGenerate}
						disabled={generating}
						className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
					>
						{generating
							? 'Generating…'
							: testMode === 'calibration'
								? 'Generate Calibration Files'
								: 'Generate Silverink Test Files'}
					</button>

					{error && <p className="text-sm text-danger text-center">{error}</p>}

					{(gcodeUrl || bitmapUrl || contractUrl) && (
						<div className="flex flex-col gap-3 pt-2">
							<div className="flex gap-3">
								{gcodeUrl && (
									<a href={gcodeUrl} download={gcodeFilename} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
										{'Download G-code'}
									</a>
								)}
								{bitmapUrl && (
									<a href={bitmapUrl} download={bitmapFilename} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
										{'Download Bitmap'}
									</a>
								)}
							</div>
							{contractUrl && (
								<a href={contractUrl} download="print_job.json" className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
									{'Download Contract (print_job.json)'}
								</a>
							)}
						</div>
					)}
				</div>

				{testMode === 'calibration' && (
					<div className="rounded-2xl bg-surface-card p-4 shadow-sm space-y-3">
						<h2 className="text-sm font-medium text-fg">{'Calibration Procedure'}</h2>
						<ol className="list-decimal list-inside text-sm text-fg-secondary space-y-1.5">
							<li>{'Print the G-code — four PLA square outlines will appear on the bed.'}</li>
							<li>{'Run the sweep with the bitmap — the inkjet deposits four filled squares.'}</li>
							<li>{'Measure the X and Y distance between each PLA outline and its ink square.'}</li>
							<li>{'Average the four measurements — this is your inkjet offset.'}</li>
							<li>{'Update the offset in the printer configuration.'}</li>
						</ol>
					</div>
				)}

				{testMode === 'silverink' && (
					<div className="rounded-2xl bg-surface-card p-4 shadow-sm space-y-3">
						<h2 className="text-sm font-medium text-fg">{'Silverink Test Procedure'}</h2>
						<ol className="list-decimal list-inside text-sm text-fg-secondary space-y-1.5">
							<li>{'Print the G-code — three ironed PLA rectangles in an L-pattern.'}</li>
							<li>{'Run the sweep with the bitmap — a single trace is deposited through each rectangle.'}</li>
							<li>{'Visually inspect that traces are centred and continuous on the ironed surface.'}</li>
							<li>{'Test conductivity of each trace with a multimeter.'}</li>
						</ol>
					</div>
				)}

			</div>
		</div>
	)
}
