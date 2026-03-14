'use client'

import Link from 'next/link'
import { type ReactElement, useState } from 'react'

import { useCatalog } from '@/hooks/useCatalog'
import type { CatalogComponent, CatalogPin } from '@/types/models'

function PinDiagram ({ pins, body }: { pins: CatalogPin[]; body: CatalogComponent['body'] }): ReactElement {
	const w = body.width_mm ?? body.diameter_mm ?? 10
	const h = body.length_mm ?? body.diameter_mm ?? 10
	const scale = 6
	const pad = 30

	const svgW = w * scale + pad * 2
	const svgH = h * scale + pad * 2
	const cx = pad
	const cy = pad

	return (
		<svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-70">
			{body.shape === 'circle' ? (
				<circle cx={cx + (w * scale) / 2} cy={cy + (h * scale) / 2} r={(w * scale) / 2} fill="#efeee9" stroke="#888" strokeWidth={1} />
			) : (
				<rect x={cx} y={cy} width={w * scale} height={h * scale} rx={2} fill="#efeee9" stroke="#888" strokeWidth={1} />
			)}
			{pins.map(pin => {
				const [px, py] = pin.position_mm
				const x = cx + px * scale
				const y = cy + py * scale
				const color = pin.direction === 'in' ? '#3b82f6' : pin.direction === 'out' ? '#ef4444' : '#eab308'
				return (
					<g key={pin.id}>
						<circle cx={x} cy={y} r={3} fill={color} />
						<text x={x} y={y - 5} textAnchor="middle" fontSize={7} fill="#555">{pin.label}</text>
					</g>
				)
			})}
		</svg>
	)
}

function ComponentCard ({ component, onSelect }: { component: CatalogComponent; onSelect: () => void }): ReactElement {
	return (
		<button
			onClick={onSelect}
			className="rounded-2xl bg-white p-4 text-left shadow-sm hover:shadow-md transition-shadow w-full"
		>
			<h3 className="text-sm font-semibold text-stone-800">{component.name}</h3>
			<p className="mt-1 text-xs text-stone-500 line-clamp-2">{component.description}</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<span className="rounded bg-[#efeee9] px-1.5 py-0.5 text-[10px] uppercase text-stone-500">
					{component.body.shape}{' '}{component.body.width_mm ?? component.body.diameter_mm}{'\u00d7'}{component.body.length_mm ?? component.body.diameter_mm}{'mm'}
				</span>
				<span className="rounded bg-[#efeee9] px-1.5 py-0.5 text-[10px] uppercase text-stone-500">
					{component.mounting.style}
				</span>
				<span className="rounded bg-[#efeee9] px-1.5 py-0.5 text-[10px] uppercase text-stone-500">
					{component.pins.length}{' pins'}
				</span>
			</div>
		</button>
	)
}

function ComponentDetail ({ component, onClose }: { component: CatalogComponent; onClose: () => void }): ReactElement {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
			<div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-lg font-semibold text-stone-800">{component.name}</h2>
						<p className="mt-1 text-sm text-stone-500">{component.description}</p>
					</div>
					<button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">{'\u00d7'}</button>
				</div>

				<div className="mt-4 flex justify-center">
					<PinDiagram pins={component.pins} body={component.body} />
				</div>

				<div className="mt-4 space-y-3">
					<section>
						<h4 className="text-xs font-semibold uppercase text-stone-400">{'Body'}</h4>
						<div className="mt-1 text-sm text-stone-700">
							{`${component.body.shape}, ${component.body.height_mm}mm tall`}
							{component.body.width_mm && `, ${component.body.width_mm}\u00d7${component.body.length_mm}mm`}
							{component.body.diameter_mm && `, \u2300${component.body.diameter_mm}mm`}
						</div>
					</section>

					<section>
						<h4 className="text-xs font-semibold uppercase text-stone-400">{'Mounting'}</h4>
						<div className="mt-1 text-sm text-stone-700">
							{`${component.mounting.style} \u2014 keepout ${component.mounting.keepout_margin_mm}mm`}
							{component.mounting.blocks_routing && ' (blocks routing)'}
						</div>
					</section>

					<section>
						<h4 className="text-xs font-semibold uppercase text-stone-400">{'Pins ('}{component.pins.length}{')'}</h4>
						<div className="mt-1 space-y-1">
							{component.pins.map(pin => (
								<div key={pin.id} className="flex items-center gap-2 text-xs text-stone-600">
									<span className={`inline-block size-2 rounded-full ${pin.direction === 'in' ? 'bg-blue-500' : pin.direction === 'out' ? 'bg-red-500' : 'bg-yellow-500'}`} />
									<span className="font-mono font-semibold">{pin.label}</span>
									<span className="text-stone-400">{'\u2014'}</span>
									<span>{pin.description}</span>
								</div>
							))}
						</div>
					</section>

					{component.pin_groups && component.pin_groups.length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-stone-400">{'Pin Groups'}</h4>
							<div className="mt-1 space-y-1">
								{component.pin_groups.map(g => (
									<div key={g.id} className="text-xs text-stone-600">
										<span className="font-semibold">{g.id}</span>{': '}{g.pin_ids.join(', ')}
										{g.description && ` \u2014 ${g.description}`}
									</div>
								))}
							</div>
						</section>
					)}
				</div>
			</div>
		</div>
	)
}

export default function CatalogPage (): ReactElement {
	const { uiComponents, internalComponents, loading } = useCatalog()
	const [selected, setSelected] = useState<CatalogComponent | null>(null)
	const [filter, setFilter] = useState('')

	const matches = (c: CatalogComponent) => {
		if (!filter) { return true }
		const f = filter.toLowerCase()
		return c.name.toLowerCase().includes(f) || c.description.toLowerCase().includes(f) || c.id.toLowerCase().includes(f)
	}

	const filteredUI = uiComponents.filter(matches)
	const filteredInternal = internalComponents.filter(matches)

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-surface">
				<span className="text-sm text-stone-500">{'Loading catalog\u2026'}</span>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-surface p-8">
			<div className="mx-auto max-w-4xl">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-stone-800">{'Component Catalog'}</h1>
						<p className="mt-1 text-sm text-stone-500">{uiComponents.length + internalComponents.length}{' components available'}</p>
					</div>
					<Link href="/" className="text-sm text-accent hover:underline">{'\u2190 Back to main'}</Link>
				</div>

				<input
					type="text"
					value={filter}
					onChange={e => setFilter(e.target.value)}
					placeholder="Filter components\u2026"
					className="mt-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400"
				/>

				{filteredUI.length > 0 && (
					<section className="mt-6">
						<h2 className="mb-3 text-sm font-semibold text-stone-600">{'UI Components'}</h2>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{filteredUI.map(c => (
								<ComponentCard key={c.id} component={c} onSelect={() => setSelected(c)} />
							))}
						</div>
					</section>
				)}

				{filteredInternal.length > 0 && (
					<section className="mt-6">
						<h2 className="mb-3 text-sm font-semibold text-stone-600">{'Internal Components'}</h2>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{filteredInternal.map(c => (
								<ComponentCard key={c.id} component={c} onSelect={() => setSelected(c)} />
							))}
						</div>
					</section>
				)}

				{filteredUI.length === 0 && filteredInternal.length === 0 && (
					<p className="mt-8 text-center text-sm text-stone-500">{'No components match "'}{filter}{'"'}</p>
				)}
			</div>

			{selected && <ComponentDetail component={selected} onClose={() => setSelected(null)} />}
		</div>
	)
}
