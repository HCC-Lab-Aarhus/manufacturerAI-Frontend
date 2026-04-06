'use client'

import Link from 'next/link'
import { type ReactElement, useState } from 'react'

import ComponentPreview3D from '@/components/viewport/ComponentPreview3D'
import { useCatalog } from '@/hooks/useCatalog'
import type { CatalogComponent, CatalogPin } from '@/types/models'

const PIN_COLORS = { in: 'var(--color-pin-input)', out: 'var(--color-pin-output)', bidirectional: 'var(--color-pin-bidir)' } as const
const SCALE = 10
const PAD = 30

function PinDiagram ({ pins, body }: { pins: CatalogPin[]; body: CatalogComponent['body'] }): ReactElement {
	const bodyW = body.width_mm ?? body.diameter_mm ?? 10
	const bodyH = body.length_mm ?? body.diameter_mm ?? 10

	const xs = pins.map(p => p.position_mm[0]).concat([-bodyW / 2, bodyW / 2])
	const ys = pins.map(p => p.position_mm[1]).concat([-bodyH / 2, bodyH / 2])
	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(...ys)
	const maxY = Math.max(...ys)

	const svgW = (maxX - minX) * SCALE + PAD * 2 + 40
	const svgH = (maxY - minY) * SCALE + PAD * 2 + 28
	const ox = PAD + 20 - minX * SCALE
	const oy = PAD + 8 - minY * SCALE

	return (
		<svg viewBox={`0 0 ${Math.max(svgW, 120)} ${Math.max(svgH, 80)}`} className="w-full max-w-80">
			{body.shape === 'circle' ? (
				<circle cx={ox} cy={oy} r={(bodyW / 2) * SCALE} fill="none" stroke="var(--color-fg-muted)" strokeWidth={1.5} strokeDasharray="4,3" />
			) : (
				<rect x={ox + (-bodyW / 2) * SCALE} y={oy + (-bodyH / 2) * SCALE} width={bodyW * SCALE} height={bodyH * SCALE} rx={2} fill="none" stroke="var(--color-fg-muted)" strokeWidth={1.5} strokeDasharray="4,3" />
			)}
			{pins.map(pin => {
				const px = ox + pin.position_mm[0] * SCALE
				const py = oy + pin.position_mm[1] * SCALE
				const color = PIN_COLORS[pin.direction] ?? 'var(--color-fg-muted)'
				const r = Math.max((pin.hole_diameter_mm / 2) * SCALE * 1.5, 3.5)
				return (
					<g key={pin.id}>
						<circle cx={px} cy={py} r={r} fill={color} opacity={0.85} />
						<text x={px} y={py - r - 3} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="var(--color-fg-secondary)">{pin.id}</text>
					</g>
				)
			})}
			<circle cx={10} cy={svgH - 10} r={3.5} fill={PIN_COLORS.in} />
			<text x={18} y={svgH - 7} fontSize={8} fill="var(--color-fg-muted)">{'in'}</text>
			<circle cx={38} cy={svgH - 10} r={3.5} fill={PIN_COLORS.out} />
			<text x={46} y={svgH - 7} fontSize={8} fill="var(--color-fg-muted)">{'out'}</text>
			<circle cx={68} cy={svgH - 10} r={3.5} fill={PIN_COLORS.bidirectional} />
			<text x={76} y={svgH - 7} fontSize={8} fill="var(--color-fg-muted)">{'bidir'}</text>
		</svg>
	)
}

function ComponentCard ({ component, onSelect }: { component: CatalogComponent; onSelect: () => void }): ReactElement {
	return (
		<button
			onClick={onSelect}
			className="rounded-2xl bg-surface-card p-4 text-left shadow-sm hover:shadow-md transition-shadow w-full"
		>
			<h3 className="text-sm font-semibold text-fg">{component.name}</h3>
			<p className="mt-1 text-xs text-fg-muted line-clamp-2">{component.description}</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<span className="rounded bg-surface-chip px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
					{component.body.shape}{' '}{component.body.width_mm ?? component.body.diameter_mm}{'×'}{component.body.length_mm ?? component.body.diameter_mm}{'mm'}
				</span>
				<span className="rounded bg-surface-chip px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
					{component.mounting.style}
				</span>
				<span className="rounded bg-surface-chip px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
					{component.pins.length}{' pins'}
				</span>
			</div>
		</button>
	)
}

function ComponentDetail ({ component, onClose }: { component: CatalogComponent; onClose: () => void }): ReactElement {
	const [view3D, setView3D] = useState(false)
	const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
	const m = component.mounting
	const features = component.scad?.features ?? []
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
			<div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-lg font-semibold text-fg">{component.name}</h2>
						<p className="mt-1 text-sm text-fg-muted">{component.description}</p>
					</div>
					<button onClick={onClose} className="text-fg-muted hover:text-fg text-xl leading-none">{'×'}</button>
				</div>

				<div className="mt-3 flex flex-wrap gap-1.5">
					<span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text">{m.style}{' mount'}</span>
					{component.ui_placement && <span className="rounded bg-info-bg px-2 py-0.5 text-xs font-medium text-info-fg">{'UI placement'}</span>}
					{m.blocks_routing && <span className="rounded bg-error-bg px-2 py-0.5 text-xs font-medium text-error-fg">{'blocks routing'}</span>}
				</div>

				<div className="mt-4">
					<div className="mb-2 flex justify-end">
						<div className="inline-flex rounded-lg bg-surface-chip p-0.5 text-xs">
							<button
								className={`rounded-md px-3 py-1 transition-colors ${!view3D ? 'bg-surface-card text-fg shadow-sm' : 'text-fg-muted hover:text-fg'}`}
								onClick={() => setView3D(false)}
							>{'2D'}</button>
							<button
								className={`rounded-md px-3 py-1 transition-colors ${view3D ? 'bg-surface-card text-fg shadow-sm' : 'text-fg-muted hover:text-fg'}`}
								onClick={() => setView3D(true)}
							>{'3D'}</button>
						</div>
					</div>
					{view3D ? (
						<div className="flex gap-3">
							<ComponentPreview3D component={component} highlightedFeature={hoveredFeature} className="h-72 flex-1 min-w-0 rounded-xl overflow-hidden" />
							{features.length > 0 && (
								<ul className="h-72 w-48 shrink-0 overflow-y-auto rounded-xl bg-surface-chip p-2 text-xs space-y-0.5" onMouseLeave={() => setHoveredFeature(null)}>
									{features.map((f, i) => (
										<li
											key={i}
											className={`rounded px-2 py-1 cursor-default transition-colors ${hoveredFeature === i ? 'bg-accent/20 text-accent-text' : 'text-fg-secondary hover:bg-surface-card'}`}
											onMouseEnter={() => setHoveredFeature(i)}
										>
											{f.label || `Feature ${i + 1}`}
										</li>
									))}
								</ul>
							)}
						</div>
					) : (
						<div className="flex justify-center">
							<PinDiagram pins={component.pins} body={component.body} />
						</div>
					)}
				</div>

				<div className="mt-4 space-y-4">
					{/* Body */}
					<section>
						<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Body'}</h4>
						<table className="mt-1 w-full text-sm text-fg">
							<tbody>
								<tr><td className="w-36 py-0.5 text-fg-muted">{'Shape'}</td><td>{component.body.shape}</td></tr>
								{component.body.width_mm != null && <tr><td className="py-0.5 text-fg-muted">{'Width'}</td><td>{component.body.width_mm}{' mm'}</td></tr>}
								{component.body.length_mm != null && <tr><td className="py-0.5 text-fg-muted">{'Length'}</td><td>{component.body.length_mm}{' mm'}</td></tr>}
								{component.body.diameter_mm != null && <tr><td className="py-0.5 text-fg-muted">{'Diameter'}</td><td>{component.body.diameter_mm}{' mm'}</td></tr>}
								<tr><td className="py-0.5 text-fg-muted">{'Height'}</td><td>{component.body.height_mm}{' mm'}</td></tr>
							</tbody>
						</table>
					</section>

					{/* Mounting */}
					<section>
						<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Mounting'}</h4>
						<table className="mt-1 w-full text-sm text-fg">
							<tbody>
								<tr><td className="w-36 py-0.5 text-fg-muted">{'Style'}</td><td>{m.style}</td></tr>
								<tr><td className="py-0.5 text-fg-muted">{'Allowed'}</td><td>{m.allowed_styles.join(', ')}</td></tr>
								<tr><td className="py-0.5 text-fg-muted">{'Keepout'}</td><td>{m.keepout_margin_mm}{' mm'}</td></tr>
								<tr><td className="py-0.5 text-fg-muted">{'Blocks routing'}</td><td>{m.blocks_routing ? 'Yes' : 'No'}</td></tr>
								{m.cap && <>
									<tr><td className="py-0.5 text-fg-muted">{'Cap diameter'}</td><td>{m.cap.diameter_mm}{' mm'}</td></tr>
									<tr><td className="py-0.5 text-fg-muted">{'Cap height'}</td><td>{m.cap.height_mm}{' mm'}</td></tr>
									<tr><td className="py-0.5 text-fg-muted">{'Cap clearance'}</td><td>{m.cap.hole_clearance_mm}{' mm'}</td></tr>
								</>}
								{m.hatch && <>
									<tr><td className="py-0.5 text-fg-muted">{'Hatch'}</td><td>{m.hatch.enabled ? 'Enabled' : 'Disabled'}</td></tr>
									<tr><td className="py-0.5 text-fg-muted">{'Hatch clearance'}</td><td>{m.hatch.clearance_mm}{' mm'}</td></tr>
									<tr><td className="py-0.5 text-fg-muted">{'Hatch thickness'}</td><td>{m.hatch.thickness_mm}{' mm'}</td></tr>
								</>}
							</tbody>
						</table>
					</section>

					{/* Pins */}
					<section>
						<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Pins ('}{component.pins.length}{')'}</h4>
						<div className="mt-1 overflow-x-auto">
							<table className="w-full text-xs">
								<thead>
									<tr className="border-b border-border text-left text-fg-muted">
										<th className="py-1 pr-2">{'ID'}</th>
										<th className="py-1 pr-2">{'Label'}</th>
										<th className="py-1 pr-2">{'Position'}</th>
										<th className="py-1 pr-2">{'Dir'}</th>
										<th className="py-1 pr-2">{'Voltage'}</th>
										<th className="py-1 pr-2">{'Current'}</th>
										<th className="py-1 pr-2">{'Hole \u2300'}</th>
									</tr>
								</thead>
								<tbody>
									{component.pins.map(pin => (
										<tr key={pin.id} className="border-b border-border/50">
											<td className="py-1 pr-2 font-mono font-medium text-fg">{pin.id}</td>
											<td className="py-1 pr-2 text-fg-secondary">{pin.label}</td>
											<td className="py-1 pr-2 font-mono text-fg-muted">{'['}{pin.position_mm[0]}{', '}{pin.position_mm[1]}{']'}</td>
											<td className="py-1 pr-2">
												<span className={`inline-block size-2 rounded-full mr-1 align-middle ${pin.direction === 'in' ? 'bg-pin-input' : pin.direction === 'out' ? 'bg-pin-output' : 'bg-pin-bidir'}`} />
												{pin.direction}
											</td>
											<td className="py-1 pr-2 text-fg-muted">{pin.voltage_v != null ? `${pin.voltage_v}V` : '\u2014'}</td>
											<td className="py-1 pr-2 text-fg-muted">{pin.current_max_ma != null ? `${pin.current_max_ma}mA` : '\u2014'}</td>
											<td className="py-1 pr-2 text-fg-muted">{pin.hole_diameter_mm}{'mm'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					{/* Internal Nets */}
					{component.internal_nets && component.internal_nets.length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Internal Nets'}</h4>
							<div className="mt-1 space-y-0.5">
								{component.internal_nets.map((net, i) => (
									<div key={i} className="text-sm text-fg-secondary">
										<span className="text-fg-muted">{'Net '}{i + 1}{':'}</span>{' '}{net.join(' \u2194 ')}
									</div>
								))}
							</div>
						</section>
					)}

					{/* Pin Groups */}
					{component.pin_groups && component.pin_groups.length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Pin Groups'}</h4>
							<div className="mt-1 overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr className="border-b border-border text-left text-fg-muted">
											<th className="py-1 pr-2">{'Group'}</th>
											<th className="py-1 pr-2">{'Pins'}</th>
											<th className="py-1 pr-2">{'Allocatable'}</th>
											<th className="py-1 pr-2">{'Net'}</th>
											<th className="py-1 pr-2">{'Capabilities'}</th>
										</tr>
									</thead>
									<tbody>
										{component.pin_groups.map(g => (
											<tr key={g.id} className="border-b border-border/50">
												<td className="py-1 pr-2 font-semibold text-fg">{g.id}</td>
												<td className="py-1 pr-2 max-w-50 wrap-break-word text-fg-secondary">{g.pin_ids.join(', ')}</td>
												<td className="py-1 pr-2 text-fg-muted">{g.allocatable ? '\u2713' : '\u2014'}</td>
												<td className="py-1 pr-2 text-fg-muted">{g.fixed_net ?? '\u2014'}</td>
												<td className="py-1 pr-2 text-fg-muted">{g.capabilities?.join(', ') ?? '\u2014'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					)}

					{/* Configurable */}
					{component.configurable && Object.keys(component.configurable).length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Configurable'}</h4>
							<pre className="mt-1 overflow-x-auto rounded-lg bg-surface-chip p-3 text-xs text-fg-secondary">
								{JSON.stringify(component.configurable, null, 2)}
							</pre>
						</section>
					)}

					{/* SCAD Features */}
					{component.scad?.features && component.scad.features.length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-fg-muted">{'SCAD Features'}</h4>
							<table className="mt-1 w-full text-xs">
								<thead>
									<tr className="border-b border-border text-left text-fg-muted">
										<th className="py-1 pr-2">{'Label'}</th>
										<th className="py-1 pr-2">{'Shape'}</th>
										<th className="py-1 pr-2">{'Position'}</th>
										<th className="py-1 pr-2">{'Size'}</th>
										<th className="py-1">{'Depth'}</th>
									</tr>
								</thead>
								<tbody>
									{component.scad.features.map((f, i) => (
										<tr key={i} className="border-b border-border/50">
											<td className="py-1 pr-2 text-fg-secondary">{f.label ?? '—'}</td>
											<td className="py-1 pr-2 text-fg-secondary">{f.shape}</td>
											<td className="py-1 pr-2 font-mono text-fg-secondary">{f.position_mm.map(v => v.toFixed(1)).join(', ')}</td>
											<td className="py-1 pr-2 font-mono text-fg-secondary">
												{f.shape === 'circle'
													? `ø${f.diameter_mm?.toFixed(1)}`
													: `${f.width_mm?.toFixed(1)} × ${f.length_mm?.toFixed(1)}`}
											</td>
											<td className="py-1 font-mono text-fg-secondary">{f.depth_mm?.toFixed(2) ?? '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</section>
					)}

					{/* Support Blockers */}
					{component.support_blockers && component.support_blockers.length > 0 && (
						<section>
							<h4 className="text-xs font-semibold uppercase text-fg-muted">{'Support Blockers'}</h4>
							<table className="mt-1 w-full text-xs">
								<thead>
									<tr className="border-b border-border text-left text-fg-muted">
										<th className="py-1 pr-2">{'Shape'}</th>
										<th className="py-1 pr-2">{'Position'}</th>
										<th className="py-1 pr-2">{'Size'}</th>
										<th className="py-1 pr-2">{'Height'}</th>
										<th className="py-1">{'Z Anchor'}</th>
									</tr>
								</thead>
								<tbody>
									{component.support_blockers.map((b, i) => (
										<tr key={i} className="border-b border-border/50">
											<td className="py-1 pr-2 text-fg-secondary">{b.shape}</td>
											<td className="py-1 pr-2 font-mono text-fg-secondary">{b.position_mm.map(v => v.toFixed(1)).join(', ')}</td>
											<td className="py-1 pr-2 font-mono text-fg-secondary">
												{b.shape === 'circle'
													? `ø${b.diameter_mm?.toFixed(1)}`
													: `${b.width_mm?.toFixed(1)} × ${b.length_mm?.toFixed(1)}`}
											</td>
											<td className="py-1 pr-2 font-mono text-fg-secondary">{b.height_mm.toFixed(1)}</td>
											<td className="py-1 font-mono text-fg-secondary">{b.z_anchor ?? 'cavity_start'}</td>
										</tr>
									))}
								</tbody>
							</table>
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
				<span className="text-sm text-fg-muted">{'Loading catalog…'}</span>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-surface p-8">
			<div className="mx-auto max-w-4xl">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-fg">{'Component Catalog'}</h1>
						<p className="mt-1 text-sm text-fg-muted">{uiComponents.length + internalComponents.length}{' components available'}</p>
					</div>
					<Link href="/" className="text-sm text-accent hover:underline">{'\u2190 Back to main'}</Link>
				</div>

				<input
					type="text"
					value={filter}
					onChange={e => setFilter(e.target.value)}
					placeholder="Filter components\u2026"
					className="mt-4 w-full rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm text-fg placeholder:text-fg-muted"
				/>

				{filteredUI.length > 0 && (
					<section className="mt-6">
						<h2 className="mb-3 text-sm font-semibold text-fg-secondary">{'UI Components'}</h2>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{filteredUI.map(c => (
								<ComponentCard key={c.id} component={c} onSelect={() => setSelected(c)} />
							))}
						</div>
					</section>
				)}

				{filteredInternal.length > 0 && (
					<section className="mt-6">
						<h2 className="mb-3 text-sm font-semibold text-fg-secondary">{'Internal Components'}</h2>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{filteredInternal.map(c => (
								<ComponentCard key={c.id} component={c} onSelect={() => setSelected(c)} />
							))}
						</div>
					</section>
				)}

				{filteredUI.length === 0 && filteredInternal.length === 0 && (
					<p className="mt-8 text-center text-sm text-fg-muted">{'No components match "'}{filter}{'"'}</p>
				)}
			</div>

			{selected && <ComponentDetail component={selected} onClose={() => setSelected(null)} />}
		</div>
	)
}
