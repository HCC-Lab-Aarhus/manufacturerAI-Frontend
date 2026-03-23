'use client'

import Link from 'next/link'
import { type ReactElement, useEffect, useState } from 'react'

import {
	listPrinters, listFilaments,
	generateCalibration, generateSilverinkTest,
	generateComponents, generateLayers, generateSpacing,
	generateWidth, generateAllTests,
} from '@/lib/api'
import type { Printer, Filament } from '@/types/models'

type TestMode = 'calibration' | 'silverink' | 'components' | 'layers' | 'spacing' | 'width'

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

	// Silverink / layers / spacing params
	const [rectWidth, setRectWidth] = useState(10)
	const [rectHeight, setRectHeight] = useState(20)
	const [layers, setLayers] = useState(4)



	// Spacing params (landscape, 2x)
	const [plRectWidth, setPlRectWidth] = useState(40)
	const [plRectHeight, setPlRectHeight] = useState(20)
	const [plLayers, setPlLayers] = useState(4)

	// Width params
	const [twRectWidth, setTwRectWidth] = useState(40)
	const [twRectHeight, setTwRectHeight] = useState(20)
	const [twLayers, setTwLayers] = useState(4)

	const [generating, setGenerating] = useState(false)
	const [error, setError] = useState('')
	const [gcodeUrl, setGcodeUrl] = useState<string | null>(null)
	const [bitmapUrls, setBitmapUrls] = useState<{ url: string; filename: string }[]>([])
	const [contractUrl, setContractUrl] = useState<string | null>(null)
	const [gcodeFilename, setGcodeFilename] = useState('calibration.gcode')

	const [bulkFilaments, setBulkFilaments] = useState<Set<string>>(new Set())
	const [bulkGenerating, setBulkGenerating] = useState(false)
	const [bulkError, setBulkError] = useState('')
	const [bulkDone, setBulkDone] = useState(false)

	const selectedPrinter = printers.find(p => p.id === printer)

	useEffect(() => {
		listPrinters().then(p => {
			setPrinters(p)
			const mk3s = p.find(pr => pr.id === 'mk3s')
			if (mk3s) { setPrinter(mk3s.id) } else if (p.length) { setPrinter(p[0].id) }
		}).catch(() => {})
		listFilaments().then(f => { setFilaments(f) }).catch(() => {})
	}, [])

	const handlePrinterChange = (id: string) => {
		setPrinter(id)
	}

	const clearDownloads = () => {
		setGcodeUrl(null)
		setBitmapUrls([])
		setContractUrl(null)
	}

	const makeBlobUrl = (text: string, type = 'text/plain') =>
		URL.createObjectURL(new Blob([text], { type }))

	const handleGenerate = async () => {
		setGenerating(true)
		setError('')
		clearDownloads()
		try {
			if (testMode === 'layers') {
				const data = await generateLayers({
					printer, filament, padding,
					rect_width: rectWidth, rect_height: rectHeight, layers,
				})
				setGcodeFilename(String(data.contract.gcode_file || 'layers.gcode'))
				setGcodeUrl(makeBlobUrl(data.gcode))
				setBitmapUrls([
					{ url: makeBlobUrl(data.bitmap_1), filename: 'layers_1.txt' },
					{ url: makeBlobUrl(data.bitmap_2), filename: 'layers_2.txt' },
					{ url: makeBlobUrl(data.bitmap_3), filename: 'layers_3.txt' },
				])
				setContractUrl(makeBlobUrl(JSON.stringify(data.contract, null, 2), 'application/json'))
			} else {
				let data
				switch (testMode) {
					case 'calibration':
						data = await generateCalibration({
							printer, filament,
							box_size: boxSize, padding, square_size: squareSize,
						})
						break
					case 'silverink':
						data = await generateSilverinkTest({
							printer, filament, padding,
							rect_width: rectWidth, rect_height: rectHeight, layers,
						})
						break
					case 'components':
						data = await generateComponents({
							printer, filament, padding,
						})
						break
					case 'spacing':
						data = await generateSpacing({
							printer, filament, padding,
							rect_width: plRectWidth, rect_height: plRectHeight,
							layers: plLayers,
						})
						break
					case 'width':
						data = await generateWidth({
							printer, filament, padding,
							rect_width: twRectWidth, rect_height: twRectHeight,
							layers: twLayers,
						})
						break
				}
				setGcodeFilename(String(data.contract.gcode_file || `${testMode}.gcode`))
				setGcodeUrl(makeBlobUrl(data.gcode))
				setBitmapUrls([{
					url: makeBlobUrl(data.bitmap),
					filename: String(data.contract.bitmap_file || `${testMode}_bitmap.txt`),
				}])
				setContractUrl(makeBlobUrl(JSON.stringify(data.contract, null, 2), 'application/json'))
			}
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
		},
		components: {
			heading: 'Component Trace Test',
			description: 'Loads real catalog components (resistor, button, battery) onto a shared plate with raised blocks, pinholes, and trace cutouts derived from actual catalog geometry.'
		},
		layers: {
			heading: 'Progressive Trace Test',
			description: 'Three rectangles with an increasing number of centred traces across three bitmaps.'
		},
		spacing: {
			heading: 'Parallel Lines Test',
			description: 'Three landscape rectangles with parallel lines at increasing spacing (1–20 px). Tests minimum separation.'
		},
		width: {
			heading: 'Trace Width Test',
			description: 'Single rectangle with lines of increasing thickness (1–10 px) at 10 px spacing. Tests printable trace widths.'
		}
	}

	const modeLabels: Record<TestMode, string> = {
		calibration: 'Calibration',
		silverink: 'Silverink',
		components: 'Components',
		layers: 'Layers',
		spacing: 'Spacing',
		width: 'Width'
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
				<div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-card p-1 shadow-sm">
					{(['calibration', 'silverink', 'components', 'layers', 'spacing', 'width'] as const).map(mode => (
						<button
							key={mode}
							onClick={() => { setTestMode(mode); clearDownloads() }}
							className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
								testMode === mode
									? 'bg-accent text-white'
									: 'text-fg-secondary hover:text-fg'
							}`}
						>
							{modeLabels[mode]}
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
							<option value="">{'Select filament…'}</option>
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

					{(testMode === 'silverink' || testMode === 'layers') && (
						<>
							{field('Rectangle Width (mm)', rectWidth, setRectWidth, 1)}
							{field('Rectangle Height (mm)', rectHeight, setRectHeight, 1)}
							{field('Layers', layers, setLayers)}
						</>
					)}



					{testMode === 'spacing' && (
						<>
							{field('Rectangle Width (mm)', plRectWidth, setPlRectWidth, 1)}
							{field('Rectangle Height (mm)', plRectHeight, setPlRectHeight, 1)}
							{field('Layers', plLayers, setPlLayers)}
						</>
					)}

					{testMode === 'width' && (
						<>
							{field('Rectangle Width (mm)', twRectWidth, setTwRectWidth, 1)}
							{field('Rectangle Height (mm)', twRectHeight, setTwRectHeight, 1)}
							{field('Layers', twLayers, setTwLayers)}
						</>
					)}

					<button
						onClick={handleGenerate}
						disabled={generating || !filament}
						className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
					>
						{generating ? 'Generating…' : 'Generate Files'}
					</button>

					{error && <p className="text-sm text-danger text-center">{error}</p>}

					{(gcodeUrl || bitmapUrls.length > 0 || contractUrl) && (
						<div className="flex flex-col gap-3 pt-2">
							<div className="flex gap-3">
								{gcodeUrl && (
									<a href={gcodeUrl} download={gcodeFilename} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
										{'Download G-code'}
									</a>
								)}
							</div>
							{bitmapUrls.map(b => (
								<a key={b.filename} href={b.url} download={b.filename} className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover transition-colors">
									{bitmapUrls.length > 1 ? `Download ${b.filename}` : 'Download Bitmap'}
								</a>
							))}
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

				{/* Generate All Test Files */}
				<div className="rounded-2xl bg-surface-card p-6 shadow-sm space-y-4">
					<h2 className="text-sm font-medium text-fg">{'Generate All Test Files'}</h2>
					<p className="text-sm text-fg-muted">{'Generate calibration + all test G-code and bitmaps for the selected filaments, saved to a folder you choose.'}</p>

					<div className="space-y-2">
						<label className="text-sm text-fg-secondary">{'Filaments'}</label>
						<div className="grid grid-cols-2 gap-2">
							{filaments.map(f => (
								<label key={f.id} className="flex items-center gap-2 text-sm text-fg">
									<input
										type="checkbox"
										checked={bulkFilaments.has(f.id)}
										onChange={e => {
											const next = new Set(bulkFilaments)
											if (e.target.checked) { next.add(f.id) } else { next.delete(f.id) }
											setBulkFilaments(next)
										}}
										className="rounded border-border"
									/>
									{f.label}
								</label>
							))}
						</div>
					</div>

					<button
						onClick={async () => {
							setBulkGenerating(true)
							setBulkError('')
							setBulkDone(false)
							try {
								if (!('showDirectoryPicker' in window)) {
									throw new Error('Your browser does not support folder picking. Use Chrome or Edge.')
								}
								const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
								const files = await generateAllTests({
									printer,
									filaments: [...bulkFilaments].join(','),
								})
								for (const [path, content] of Object.entries(files)) {
									const parts = path.split('/')
									let folder = dirHandle
									for (const part of parts.slice(0, -1)) {
										folder = await folder.getDirectoryHandle(part, { create: true })
									}
									const fileHandle = await folder.getFileHandle(parts[parts.length - 1], { create: true })
									const writable = await fileHandle.createWritable()
									await writable.write(content)
									await writable.close()
								}
								setBulkDone(true)
							} catch (e) {
								if (e instanceof DOMException && e.name === 'AbortError') return
								setBulkError(e instanceof Error ? e.message : 'Generation failed')
							} finally {
								setBulkGenerating(false)
							}
						}}
						disabled={bulkGenerating || bulkFilaments.size === 0}
						className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
					>
						{bulkGenerating ? 'Generating…' : 'Generate All Test Files'}
					</button>

					{bulkError && <p className="text-sm text-danger text-center">{bulkError}</p>}
					{bulkDone && <p className="text-sm text-green-500 text-center">{'Files saved!'}</p>}
				</div>

			</div>
		</div>
	)
}
