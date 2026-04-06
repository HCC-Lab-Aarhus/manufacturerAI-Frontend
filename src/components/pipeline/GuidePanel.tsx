'use client'

import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSession } from '@/contexts/SessionContext'
import { getPlacementResult } from '@/lib/api'
import type { Enclosure, OutlineVertex, PlacedComponent, PlacementResult } from '@/types/models'

// ── Types ────────────────────────────────────────────────────────

type ComponentType = 'controller' | 'button' | 'battery' | 'led' | 'resistor' | 'capacitor' | 'transistor' | 'component'

interface GuideStep {
	title: string
	subtitle?: string
	body: string
	componentIndices?: number[]
	showPlacementView: boolean
	section: string
}

interface GuideSection {
	name: string
	index: number
}

// ── Helpers ──────────────────────────────────────────────────────

function componentType (comp: PlacedComponent): ComponentType {
	const id = (comp.catalog_id || comp.instance_id || '').toLowerCase()
	if (id.includes('atmega') || id.includes('controller') || id.includes('mcu')) { return 'controller' }
	if (id.includes('button') || id.includes('tactile') || id.includes('switch')) { return 'button' }
	if (id.includes('battery')) { return 'battery' }
	if (id.includes('led')) { return 'led' }
	if (id.includes('resistor')) { return 'resistor' }
	if (id.includes('capacitor') || id.includes('cap_')) { return 'capacitor' }
	if (id.includes('transistor') || id.includes('npn') || id.includes('pnp')) { return 'transistor' }
	return 'component'
}

const TYPE_LABELS: Record<ComponentType, string> = {
	controller: 'Microcontroller (ATmega328P)',
	button: 'Tactile Push Button',
	battery: 'Battery Holder',
	led: 'LED',
	resistor: 'Resistor',
	capacitor: 'Capacitor',
	transistor: 'Transistor',
	component: 'Component'
}

function placementBody (ctype: ComponentType, comps: PlacedComponent[]): string {
	const label = TYPE_LABELS[ctype]
	const positionList = comps
		.map(c => `<li><strong>${esc(c.instance_id)}</strong> at (${c.x_mm.toFixed(1)}, ${c.y_mm.toFixed(1)}) mm, ${c.rotation_deg ?? 0}°</li>`)
		.join('')

	const instructions: Partial<Record<ComponentType, string>> = {
		controller:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Locate the rectangular DIP pocket with pin holes</li>' +
			'<li>Find the pin 1 marker on the chip (notch or dot)</li>' +
			'<li>Carefully align ALL pins with the holes</li>' +
			'<li>Press gently and evenly — do not force!</li></ul>' +
			'<p><strong>⚠ Important:</strong> Incorrect orientation will damage the chip.</p>',
		button:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Locate the square pocket on the enclosure</li>' +
			'<li>Orient the button so the pins align with the holes</li>' +
			'<li>Press firmly until the button sits flush</li>' +
			'<li>The button cap should protrude through the top hole</li></ul>',
		battery:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Locate the rectangular battery pocket</li>' +
			'<li>Insert the holder with contacts facing the correct direction</li>' +
			'<li>Press down until fully seated</li></ul>' +
			'<p><strong>Note:</strong> Batteries are inserted after printing is complete.</p>',
		led:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Locate the round pocket</li>' +
			'<li>Longer leg (anode, +) → marked hole</li>' +
			'<li>Shorter leg (cathode, −) → other hole</li>' +
			'<li>LED should point outward through the wall slot</li></ul>' +
			'<p><strong>⚠ Important:</strong> Wrong polarity = LED won\'t work!</p>',
		resistor:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Resistors are not polarized — either direction works</li>' +
			'<li>Bend leads at 90° to match hole spacing</li>' +
			'<li>Insert and push flush</li></ul>',
		capacitor:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Ceramic capacitors are not polarized</li>' +
			'<li>Insert leads into holes and seat flush</li></ul>',
		transistor:
			`<p><strong>Component:</strong> ${label}</p>` +
			'<p><strong>How to insert:</strong></p>' +
			'<ul><li>Match the flat side of the TO-92 package to the pocket shape</li>' +
			'<li>Ensure E/B/C pins go into the correct holes</li>' +
			'<li>Push gently until seated</li></ul>'
	}

	const base = instructions[ctype] ??
		`<p><strong>Component:</strong> ${label}</p>` +
		`<p>Insert ${comps.length} component${comps.length > 1 ? 's' : ''} at the positions shown in the placement view.</p>`

	return `${base}<p><strong>Positions:</strong></p><ul>${positionList}</ul>`
}

function esc (text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getOutlinePoints (outline: PlacementResult['outline']): OutlineVertex[] {
	if (Array.isArray(outline)) { return outline }
	return outline?.points ?? []
}

// ── Pause Z computation (mirrors backend pause_points.py) ────────

const CAVITY_START_MM = 3.0
const CEILING_MM = 2.0
const PAUSE_NOZZLE_CLEARANCE_MM = 2.0
const DEFAULT_LAYER_HEIGHT = 0.2

function snapToLayer (z: number, layerH: number): number {
	return Math.floor(z / layerH) * layerH
}

function componentZRange (
	mountingStyle: string, bodyHeight: number, ceilStart: number
): { bodyFloor: number; bodyTop: number } {
	if (mountingStyle === 'top') {
		const bodyFloor = Math.max(ceilStart - bodyHeight, CAVITY_START_MM)
		return { bodyFloor, bodyTop: bodyFloor + bodyHeight }
	}
	const bodyFloor = CAVITY_START_MM
	return { bodyFloor, bodyTop: Math.min(CAVITY_START_MM + bodyHeight, ceilStart) }
}

function computePauseZ (comp: PlacedComponent, enclosure: Enclosure): number {
	const shellHeight = enclosure.height_mm
	const ceilStart = shellHeight - CEILING_MM
	const bodyHeight = comp.body?.height_mm ?? 5
	const mounting = comp.mounting_style ?? 'internal'
	const { bodyTop } = componentZRange(mounting, bodyHeight, ceilStart)
	const z = bodyTop + PAUSE_NOZZLE_CLEARANCE_MM
	return snapToLayer(Math.min(z, ceilStart), DEFAULT_LAYER_HEIGHT)
}

// ── Step builder ─────────────────────────────────────────────────

function buildSteps (data: PlacementResult): { steps: GuideStep[]; sections: GuideSection[] } {
	const components = data.components ?? []
	const enclosure = data.enclosure
	const steps: GuideStep[] = []
	const sections: GuideSection[] = []

	// Group by component type (for checklist)
	const typeGroups = new Map<ComponentType, PlacedComponent[]>()
	for (const comp of components) {
		const ctype = componentType(comp)
		if (!typeGroups.has(ctype)) { typeGroups.set(ctype, []) }
		typeGroups.get(ctype)!.push(comp)
	}

	// Group components by computed pause Z
	const pauseGroups = new Map<number, PlacedComponent[]>()
	for (const comp of components) {
		const z = computePauseZ(comp, enclosure)
		if (!pauseGroups.has(z)) { pauseGroups.set(z, []) }
		pauseGroups.get(z)!.push(comp)
	}
	const sortedPauseZs = [...pauseGroups.keys()].sort((a, b) => a - b)

	// Introduction
	sections.push({ name: 'Introduction', index: steps.length })
	steps.push({
		title: 'Component Assembly Guide',
		subtitle: 'Introduction',
		body:
			'<p>This guide walks you through inserting each electronic component into the 3D-printed enclosure.</p>' +
			`<p>The placer has positioned <strong>${components.length} component${components.length !== 1 ? 's' : ''}</strong> inside the device outline.</p>` +
			`<p>The print will pause <strong>${sortedPauseZs.length} time${sortedPauseZs.length !== 1 ? 's' : ''}</strong> for component insertion, from lowest to highest.</p>` +
			'<p>Use the <em>Manual</em> sidebar or the arrow navigation to move between steps.</p>',
		showPlacementView: false,
		section: 'Introduction'
	})

	// Checklist
	const listItems = [...typeGroups.entries()].map(([ctype, comps]) => {
		const label = TYPE_LABELS[ctype]
		const countTag = comps.length > 1 ? ` <span class="text-fg-muted">\u00D7 ${comps.length}</span>` : ''
		return `<li>${esc(label)}${countTag}</li>`
	}).join('')

	sections.push({ name: 'Checklist', index: steps.length })
	steps.push({
		title: 'Component Checklist',
		subtitle: 'Materials Needed',
		body: `<p>Gather these components before starting:</p><ul>${listItems}</ul><p>Make sure you have everything ready before beginning assembly.</p>`,
		showPlacementView: false,
		section: 'Checklist'
	})

	// Per-pause-Z placement steps (ordered by ascending pause height)
	sortedPauseZs.forEach((z, pauseIdx) => {
		const comps = pauseGroups.get(z)!
		const indices = comps.map(c => components.indexOf(c))
		const pauseNum = pauseIdx + 1
		const sectionName = `Pause ${pauseNum}`

		sections.push({ name: sectionName, index: steps.length })

		// Sub-group by type within this pause for type-specific instructions
		const subGroups = new Map<ComponentType, PlacedComponent[]>()
		for (const comp of comps) {
			const ctype = componentType(comp)
			if (!subGroups.has(ctype)) { subGroups.set(ctype, []) }
			subGroups.get(ctype)!.push(comp)
		}

		let body = `<p>The printer will pause at <strong>${z.toFixed(1)} mm</strong>. ` +
			`Insert the following <strong>${comps.length}</strong> component${comps.length !== 1 ? 's' : ''}:</p>`

		for (const [ctype, subComps] of subGroups) {
			body += placementBody(ctype, subComps)
		}

		steps.push({
			title: `Pause ${pauseNum} \u2014 ${z.toFixed(1)} mm`,
			subtitle: `${comps.length} component${comps.length !== 1 ? 's' : ''} to insert`,
			body,
			componentIndices: indices,
			showPlacementView: true,
			section: sectionName
		})
	})

	// Finish
	sections.push({ name: 'Finish', index: steps.length })
	steps.push({
		title: 'Assembly Complete',
		subtitle: 'Final Check',
		body:
			'<p>All components have been placed.</p>' +
			'<p><strong>Checklist before continuing:</strong></p>' +
			'<ul>' +
			'<li>All components are seated flush in their pockets</li>' +
			'<li>Pin 1 / polarity markers are correctly oriented</li>' +
			'<li>All leads are fully inserted into their holes</li>' +
			'</ul>' +
			'<p>You can now proceed to the next pipeline stage.</p>',
		showPlacementView: false,
		section: 'Finish'
	})

	return { steps, sections }
}

// ── Section icons (SVG) ──────────────────────────────────────────

const SECTION_ICONS: Record<string, ReactElement> = {
	Introduction: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
	Checklist: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
	Finish: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
}

const PAUSE_ICON: ReactElement = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="9" y1="9" x2="9" y2="15" /><line x1="15" y1="9" x2="15" y2="15" /></svg>

function getSectionIcon (name: string): ReactElement {
	if (SECTION_ICONS[name]) { return SECTION_ICONS[name] }
	if (name.startsWith('Pause')) { return PAUSE_ICON }
	return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
}

// ── Placement SVG ────────────────────────────────────────────────

function PlacementSvg ({ components, outline, highlightIndices, onClickComponent }: {
	components: PlacedComponent[]
	outline: OutlineVertex[]
	highlightIndices: Set<number>
	onClickComponent: (idx: number) => void
}): ReactElement {
	const svgContent = useMemo(() => {
		if (!components.length) { return null }

		let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity

		for (const pt of outline) {
			minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y)
			maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y)
		}
		for (const comp of components) {
			const hw = ((comp.body?.width_mm ?? 10) / 2) + 2
			const hh = ((comp.body?.length_mm ?? 10) / 2) + 2
			minX = Math.min(minX, comp.x_mm - hw); minY = Math.min(minY, comp.y_mm - hh)
			maxX = Math.max(maxX, comp.x_mm + hw); maxY = Math.max(maxY, comp.y_mm + hh)
		}

		const PAD = 8
		minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD

		return { viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, minX, minY, maxX, maxY }
	}, [components, outline])

	if (!svgContent) { return <></> }

	const outlinePts = outline.map(p => `${p.x},${p.y}`).join(' ')

	return (
		<svg viewBox={svgContent.viewBox} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
			{outline.length > 1 && (
				<polygon points={outlinePts} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="0.8" />
			)}
			{components.map((comp, i) => {
				const isCur = highlightIndices.has(i)
				const body = comp.body
				const shape = body?.shape ?? 'rect'
				const bw = body?.width_mm ?? 10
				const bh = body?.length_mm ?? 10
				const rd = body?.diameter_mm ?? bw
				const rot = comp.rotation_deg ?? 0
				const cx = comp.x_mm
				const cy = comp.y_mm

				const fill = isCur ? 'var(--color-guide-active)' : 'var(--color-guide-default)'
				const stroke = isCur ? 'var(--color-accent)' : 'var(--color-border)'
				const sw = isCur ? 1.2 : 0.6
				const fontSize = Math.max(2, Math.min(4, Math.min(bw, bh) * 0.35))

				return (
					<g key={comp.instance_id} className="cursor-pointer" onClick={() => onClickComponent(i)}>
						{shape === 'circle'
							? <circle cx={cx} cy={cy} r={rd / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
							: <rect
								x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh}
								fill={fill} stroke={stroke} strokeWidth={sw} rx={0.6}
								transform={rot !== 0 ? `rotate(${rot} ${cx} ${cy})` : undefined}
							/>
						}
						{isCur && (
							<rect
								x={cx - Math.max(bw, bh) / 2 - 3} y={cy - Math.max(bw, bh) / 2 - 3}
								width={Math.max(bw, bh) + 6} height={Math.max(bw, bh) + 6}
								fill="none" stroke="var(--color-accent)" strokeWidth={0.8} rx={2}
								strokeDasharray="3,2" opacity={0.7}
							>
								<animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
							</rect>
						)}
						<text
							x={cx} y={cy + fontSize * 0.35} textAnchor="middle" fontSize={fontSize}
							fill={isCur ? 'var(--color-accent)' : 'var(--color-fg-muted)'}
							fontFamily="sans-serif"
						>
							{comp.instance_id}
						</text>
					</g>
				)
			})}
		</svg>
	)
}

// ── Main component ───────────────────────────────────────────────

export default function GuidePanel (): ReactElement {
	const { currentSession } = useSession()
	const [placement, setPlacement] = useState<PlacementResult | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [stepIndex, setStepIndex] = useState(0)

	const prevSessionRef = useRef<string | null>(null)

	useEffect(() => {
		const sid = currentSession?.id
		if (!sid || sid === prevSessionRef.current) { return }
		prevSessionRef.current = sid

		setLoading(true)
		setError(null)
		getPlacementResult(sid)
			.then(data => { setPlacement(data); setStepIndex(0) })
			.catch(() => setError('Run the placer first to generate a guide.'))
			.finally(() => setLoading(false))
	}, [currentSession?.id])

	const { steps, sections } = useMemo(() => {
		if (!placement) { return { steps: [], sections: [] } }
		return buildSteps(placement)
	}, [placement])

	const outlinePoints = useMemo(() => {
		if (!placement) { return [] }
		return getOutlinePoints(placement.outline)
	}, [placement])

	const step = steps[stepIndex] as GuideStep | undefined
	const highlightSet = useMemo(() => new Set(step?.componentIndices ?? []), [step])

	const currentSectionIdx = useMemo(() => {
		for (let i = sections.length - 1; i >= 0; i--) {
			if (stepIndex >= sections[i].index) { return i }
		}
		return 0
	}, [stepIndex, sections])

	const goToStep = useCallback((idx: number) => {
		setStepIndex(Math.max(0, Math.min(idx, steps.length - 1)))
	}, [steps.length])

	const handleComponentClick = useCallback((compIdx: number) => {
		for (let i = 0; i < steps.length; i++) {
			if (steps[i].componentIndices?.includes(compIdx)) {
				setStepIndex(i)
				return
			}
		}
	}, [steps])

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary">
				{'Loading guide\u2026'}
			</div>
		)
	}

	if (error || !placement) {
		return (
			<div className="flex h-full items-center justify-center text-fg-secondary">
				{error ?? 'No placement data available.'}
			</div>
		)
	}

	if (!step) { return <></> }

	return (
		<div className="flex h-full flex-col bg-surface">
			{/* Body */}
			<div className="flex flex-1 overflow-hidden">
				{/* Sidebar */}
				<aside className="flex w-56 shrink-0 flex-col border-r border-divider bg-surface-alt">
					<nav className="flex-1 overflow-y-auto p-2">
						{sections.map((sec, i) => (
							<button
								key={sec.name}
								onClick={() => { goToStep(sec.index) }}
								className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
									i === currentSectionIdx
										? 'bg-accent/15 text-accent-text'
										: 'text-fg-secondary hover:bg-surface hover:text-fg'
								}`}
							>
								<span className="shrink-0">{getSectionIcon(sec.name)}</span>
								{sec.name}
							</button>
						))}
					</nav>
				</aside>

				{/* Main content */}
				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="flex flex-1 overflow-hidden">
						{/* Guide text */}
						<div className="flex flex-1 flex-col overflow-y-auto p-6">
							<div className="mb-4 border-b border-border pb-4">
								<h2 className="text-xl font-semibold text-fg">{step.title}</h2>
								{step.subtitle && (
									<div className="mt-1 text-sm text-accent-text">{step.subtitle}</div>
								)}
							</div>
							<div
								className="guide-body flex-1 text-sm leading-relaxed text-fg-secondary [&_li]:mb-1 [&_p]:mb-3 [&_strong]:text-fg [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
								dangerouslySetInnerHTML={{ __html: step.body }}
							/>
							<div className="mt-4 text-xs text-fg-muted">
								{'Step '}{stepIndex + 1}{' of '}{steps.length}
							</div>
						</div>

						{/* Placement SVG */}
						{step.showPlacementView && placement && (
							<div className="flex w-80 shrink-0 flex-col border-l border-divider bg-surface-alt">
								<div className="border-b border-border px-4 py-2 text-sm font-semibold text-fg">
									{'Component Placement'}
								</div>
								<div className="flex-1 p-4">
									<PlacementSvg
										components={placement.components}
										outline={outlinePoints}
										highlightIndices={highlightSet}
										onClickComponent={handleComponentClick}
									/>
								</div>
								<div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-fg-muted">
									<span className="flex items-center gap-1">
										<span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
										{'Current'}
									</span>
									<span className="flex items-center gap-1">
										<span className="inline-block h-2.5 w-2.5 rounded-full bg-border" />
										{'Other'}
									</span>
								</div>
							</div>
						)}
					</div>

					{/* Navigation */}
					<div className="flex items-center justify-between border-t border-border px-6 py-3">
						<button
							onClick={() => goToStep(stepIndex - 1)}
							disabled={stepIndex === 0}
							className="rounded border border-border px-4 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
						>
							{'Previous'}
						</button>
						<button
							onClick={() => goToStep(stepIndex + 1)}
							disabled={stepIndex >= steps.length - 1}
							className="rounded border border-border px-4 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
						>
							{'Next'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
