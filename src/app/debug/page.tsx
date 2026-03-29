'use client'

import Link from 'next/link'
import { type ReactElement, useEffect, useState } from 'react'

import {
	listPrinters, listFilaments,
	generateCalibration, generateCombined,
	generateComponents, generateSpacing,
	generateWidth, generateSurfaceTest, generateAllTests,
} from '@/lib/api'
import type { Printer, Filament } from '@/types/models'

type TestMode = 'calibration' | 'combined' | 'components' | 'spacing' | 'width' | 'surface_test'

export default function DebugPage (): ReactElement {
	const [printers, setPrinters] = useState<Printer[]>([])
	const [filaments, setFilaments] = useState<Filament[]>([])
	const [printer, setPrinter] = useState('')
	const [filament, setFilament] = useState('')
	const [testMode, setTestMode] = useState<TestMode>('calibration')

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
		listFilaments().then(f => {
			setFilaments(f)
			setBulkFilaments(new Set(f.map(fl => fl.id)))
		}).catch(() => {})
	}, [])

	const clearDownloads = () => {
		setGcodeUrl(null)
		setBitmapUrls([])
		setContractUrl(null)
	}

	const makeBlobUrl = (text: string, type = 'text/plain') =>
		URL.createObjectURL(new Blob([text], { type }))

	const needsFilament = testMode !== 'surface_test'

	const handleGenerate = async () => {
		setGenerating(true)
		setError('')
		clearDownloads()
		try {
			if (testMode === 'surface_test') {
				const data = await generateSurfaceTest({ printer })
				setBitmapUrls([{
					url: makeBlobUrl(data.bitmap),
					filename: String(data.contract.bitmap_file || 'surface_test.txt'),
				}])
				setContractUrl(makeBlobUrl(JSON.stringify(data.contract, null, 2), 'application/json'))
			} else {
				const params = { printer, filament }
				let data
				switch (testMode) {
					case 'calibration':
						data = await generateCalibration(params)
						break
					case 'combined':
						data = await generateCombined(params)
						break
					case 'components':
						data = await generateComponents(params)
						break
					case 'spacing':
						data = await generateSpacing(params)
						break
					case 'width':
						data = await generateWidth(params)
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

	const titles: Record<TestMode, { heading: string; description: string }> = {
		calibration: {
			heading: 'Calibration Generator',
			description: 'Generates alignment squares to calibrate inkjet-to-PLA offset.'
		},
		combined: {
			heading: 'Combined Test',
			description: 'Generates trace width and trace clearance tests on one plate.'
		},
		components: {
			heading: 'Component Trace Test',
			description: 'Loads real catalog components (resistor, button, battery) onto a shared plate with raised blocks, pinholes, and trace cutouts derived from actual catalog geometry.'
		},
		spacing: {
			heading: 'Parallel Lines Test',
			description: 'Three landscape rectangles with parallel lines at increasing spacing (1–20 px). Tests minimum separation.'
		},
		width: {
			heading: 'Trace Width Test',
			description: 'Single rectangle with lines of increasing thickness (1–10 px) at 10 px spacing. Tests printable trace widths.'
		},
		surface_test: {
			heading: 'Surface Conductivity Test',
			description: 'Generates a bitmap for the surface conductivity test strip. No G-code — supply your own with ;silverink marker.'
		}
	}

	const modeLabels: Record<TestMode, string> = {
		calibration: 'Calibration',
		combined: 'Combined',
		components: 'Components',
		spacing: 'Spacing',
		width: 'Width',
		surface_test: 'Surface'
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
					{(['calibration', 'combined', 'components', 'spacing', 'width', 'surface_test'] as const).map(mode => (
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
						<select value={printer} onChange={e => setPrinter(e.target.value)} title="Printer" className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
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

					<button
						onClick={handleGenerate}
						disabled={generating || (needsFilament && !filament)}
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

				{testMode === 'surface_test' && (
					<div className="rounded-2xl bg-surface-card p-4 shadow-sm space-y-3">
						<h2 className="text-sm font-medium text-fg">{'Surface Test Procedure'}</h2>
						<ol className="list-decimal list-inside text-sm text-fg-secondary space-y-1.5">
							<li>{'Print your own G-code with the ;silverink marker injected.'}</li>
							<li>{'Download the generated bitmap and run the sweep.'}</li>
							<li>{'Test conductivity of the deposited pads with a multimeter.'}</li>
						</ol>
					</div>
				)}

				{/* Generate All Test Files */}
				<div className="rounded-2xl bg-surface-card p-6 shadow-sm space-y-4">
					<h2 className="text-sm font-medium text-fg">{'Generate All Test Files'}</h2>
					<p className="text-sm text-fg-muted">{'Generate calibration + all test G-code and bitmaps for the selected filaments, saved to a folder you choose.'}</p>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="text-sm text-fg-secondary">{'Filaments'}</label>
							<button
								type="button"
								onClick={() => {
									if (bulkFilaments.size === filaments.length) {
										setBulkFilaments(new Set())
									} else {
										setBulkFilaments(new Set(filaments.map(f => f.id)))
									}
								}}
								className="text-xs text-accent hover:underline"
							>
								{bulkFilaments.size === filaments.length ? 'Deselect All' : 'Select All'}
							</button>
						</div>
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
								const selected = [...bulkFilaments].join(',')
								const files = await generateAllTests({
									printer,
									...(selected ? { filaments: selected } : {}),
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
