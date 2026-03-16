import * as THREE from 'three'
import { normaliseOutline, expandOutlineVertices } from './viewport'
import type { EdgeProfile, HeightGrid, UIPlacement } from '@/types/models'

const PALETTE = [
	0x4ea8d8, 0x52d474, 0xeeb830, 0xee6e6e, 0xb890e8,
	0x40c0d0, 0x60e090, 0xd8b040, 0xe88080, 0x90d0e0,
]

const MAT = {
	pcb: () => new THREE.MeshPhongMaterial({ color: 0x1c3824, shininess: 10, side: THREE.DoubleSide }),
	trace: (col: number) => new THREE.LineBasicMaterial({ color: col, linewidth: 2 }),
	component: (col: number) => new THREE.MeshPhongMaterial({ color: col, shininess: 60 }),
	wallFill: () => new THREE.MeshPhongMaterial({
		color: 0x4a6888, side: THREE.FrontSide,
		transparent: true, opacity: 0.35, shininess: 0,
		depthWrite: false,
	}),
	lidFill: () => new THREE.MeshPhongMaterial({
		color: 0x5a7898, side: THREE.FrontSide,
		transparent: true, opacity: 0.18, shininess: 0,
		depthWrite: false,
		polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
	}),
}

interface SceneData {
	outline?: { x: number; y: number; ease_in?: number; ease_out?: number; z_top?: number | null; z_bottom?: number | null }[]
	enclosure?: {
		height_mm?: number
		edge_top?: EdgeProfile
		edge_bottom?: EdgeProfile
	}
	height_grid?: HeightGrid | null
	bottom_height_grid?: HeightGrid | null
	components?: {
		instance_id: string
		x_mm?: number | null
		y_mm?: number | null
		rotation_deg?: number
		body?: { shape?: string; width_mm?: number; length_mm?: number; height_mm?: number; diameter_mm?: number }
		ui_placement?: boolean
		cap_diameter_mm?: number
		cap_clearance_mm?: number
	}[]
	ui_placements?: (UIPlacement & {
		body?: { shape?: string; width_mm?: number; length_mm?: number; height_mm?: number; diameter_mm?: number }
		ui_placement?: boolean
		cap_diameter_mm?: number
		cap_clearance_mm?: number
	})[]
	traces?: { net_id: string; path: [number, number][] }[]
	pcb_contour?: [number, number][]
}

export function buildSceneContent (data: SceneData): THREE.Group {
	const group = new THREE.Group()
	if (!data) return group

	const outline = data.outline ?? []
	const enclosure = data.enclosure ?? { height_mm: 25 }
	const heightGrid = data.height_grid ?? null
	const components = data.components ?? []
	const traces = data.traces ?? []

	const { verts, corners, zTops, zBottoms } = normaliseOutline(outline)
	if (verts.length < 3) return group

	const defaultZ = enclosure.height_mm ?? 25
	const { pts: expanded, zs: expandedZ, zbots: expandedZBot, cornerIndices } =
		expandOutlineVertices(verts, corners, zTops, defaultZ, zBottoms)

	const uiPos: Record<string, { x_mm: number; y_mm: number; rotation_deg: number; body?: { shape?: string; width_mm?: number; length_mm?: number; height_mm?: number; diameter_mm?: number }; ui_placement?: boolean; cap_diameter_mm?: number; cap_clearance_mm?: number }> = {}
	for (const up of (data.ui_placements ?? [])) {
		uiPos[up.instance_id] = {
			x_mm: up.x_mm,
			y_mm: up.y_mm,
			rotation_deg: 0,
			body: (up as Record<string, unknown>).body as typeof uiPos[string]['body'],
			ui_placement: (up as Record<string, unknown>).ui_placement as boolean | undefined,
			cap_diameter_mm: (up as Record<string, unknown>).cap_diameter_mm as number | undefined,
			cap_clearance_mm: (up as Record<string, unknown>).cap_clearance_mm as number | undefined,
		}
	}

	const bottomHeightGrid = data.bottom_height_grid ?? null

	// Build merged component list: start with explicit components, then add
	// ui_placement entries that aren't already present (design-stage scenario
	// where components[] lacks body data but ui_placements has enriched bodies).
	const mergedComponents = components.map(comp => {
		const ui = uiPos[comp.instance_id]
		if (!comp.body && ui?.body) {
			return { ...comp, body: ui.body, ui_placement: ui.ui_placement, cap_diameter_mm: ui.cap_diameter_mm, cap_clearance_mm: ui.cap_clearance_mm }
		}
		return comp
	})
	// Also add ui_placement entries that have no matching component at all
	const compIds = new Set(components.map(c => c.instance_id))
	for (const [id, ui] of Object.entries(uiPos)) {
		if (!compIds.has(id) && ui.body) {
			mergedComponents.push({
				instance_id: id,
				x_mm: ui.x_mm,
				y_mm: ui.y_mm,
				rotation_deg: ui.rotation_deg,
				body: ui.body,
				ui_placement: ui.ui_placement,
				cap_diameter_mm: ui.cap_diameter_mm,
				cap_clearance_mm: ui.cap_clearance_mm,
			})
		}
	}

	const shellGroup = buildEnclosureShell(expanded, expandedZ, expandedZBot, enclosure, heightGrid, bottomHeightGrid, mergedComponents, uiPos, cornerIndices)
	group.add(shellGroup)

	group.add(buildPCBFloor(expanded, expandedZBot, bottomHeightGrid))

	const FLOOR_Z = 2

	mergedComponents.forEach((comp, i) => {
		let x = comp.x_mm, y = comp.y_mm, rot = comp.rotation_deg ?? 0
		if (x == null || y == null) {
			const ui = uiPos[comp.instance_id]
			if (!ui) return
			x = ui.x_mm; y = ui.y_mm; rot = ui.rotation_deg
		}
		const mesh = buildComponentBox({ ...comp, x_mm: x, y_mm: y, rotation_deg: rot }, FLOOR_Z, PALETTE[i % PALETTE.length])
		if (mesh) group.add(mesh)
	})

	const netColors = buildNetColorMap(traces.map(t => t.net_id))
	traces.forEach(trace => {
		const lines = buildTraceLine(trace, FLOOR_Z, netColors[trace.net_id] ?? 0xffffff)
		if (lines) group.add(lines)
	})

	return group
}

function edgeProfile (z_top: number, eBot: EdgeProfile | undefined, eTop: EdgeProfile | undefined, z_bottom = 0): { h: number; off: number }[] {
	const botType = eBot?.type ?? 'none'
	const topType = eTop?.type ?? 'none'
	const wallH = z_top - z_bottom
	const botS = Math.min(eBot?.size_mm ?? 3.0, wallH * 0.42)
	const topS = Math.min(eTop?.size_mm ?? 3.0, wallH * 0.42)
	const ARC = 8
	const pts: { h: number; off: number }[] = []

	if (botType === 'chamfer') {
		pts.push({ h: z_bottom, off: botS })
		pts.push({ h: z_bottom + botS, off: 0 })
	} else if (botType === 'fillet') {
		for (let k = 0; k <= ARC; k++) {
			const a = (k / ARC) * (Math.PI / 2)
			pts.push({ h: z_bottom + botS * (1 - Math.cos(a)), off: botS * (1 - Math.sin(a)) })
		}
	} else {
		pts.push({ h: z_bottom, off: 0 })
	}

	if (topType === 'chamfer') {
		pts.push({ h: z_top - topS, off: 0 })
		pts.push({ h: z_top, off: topS })
	} else if (topType === 'fillet') {
		for (let k = 0; k <= ARC; k++) {
			const a = (k / ARC) * (Math.PI / 2)
			pts.push({
				h: (z_top - topS) + topS * Math.sin(a),
				off: topS * (1 - Math.cos(a)),
			})
		}
	} else {
		pts.push({ h: z_top, off: 0 })
	}

	return pts
}

function buildEnclosureShell (
	pts: [number, number][],
	expandedZ: number[],
	expandedZBot: number[],
	enclosure: SceneData['enclosure'],
	heightGrid: HeightGrid | null,
	_bottomHeightGrid: HeightGrid | null,
	compList: SceneData['components'],
	uiPosMap: Record<string, { x_mm: number; y_mm: number; rotation_deg: number }>,
	cornerIndices: number[]
): THREE.Group {
	const group = new THREE.Group()
	const eTop = enclosure?.edge_top
	const eBot = enclosure?.edge_bottom
	const N = pts.length

	let cx = 0, cz = 0
	pts.forEach(p => { cx += p[0]; cz += p[1] })
	cx /= N; cz /= N

	function insetPt (x: number, y: number, off: number): [number, number] {
		if (off === 0) return [x, y]
		const dx = x - cx, dz = y - cz
		const dist = Math.hypot(dx, dz)
		if (dist < 0.01) return [x, y]
		const f = Math.max(0, (dist - off)) / dist
		return [cx + dx * f, cz + dz * f]
	}

	// Wall fill
	{
		const wallPos: number[] = []
		const wallIdx: number[] = []
		let vi = 0
		for (let i = 0; i < N; i++) {
			const j = (i + 1) % N
			const x0 = pts[i][0], y0 = pts[i][1], z0 = expandedZ[i]
			const x1 = pts[j][0], y1 = pts[j][1], z1 = expandedZ[j]
			const b0 = expandedZBot[i], b1 = expandedZBot[j]
			const profL = edgeProfile(z0, eBot, eTop, b0)
			const profR = edgeProfile(z1, eBot, eTop, b1)
			for (let k = 0; k < profL.length - 1; k++) {
				const { h: hLb, off: oLb } = profL[k]
				const { h: hLt, off: oLt } = profL[k + 1]
				const { h: hRb, off: oRb } = profR[k]
				const { h: hRt, off: oRt } = profR[k + 1]
				const [xLb, zLb] = insetPt(x0, y0, oLb)
				const [xLt, zLt] = insetPt(x0, y0, oLt)
				const [xRb, zRb] = insetPt(x1, y1, oRb)
				const [xRt, zRt] = insetPt(x1, y1, oRt)
				wallPos.push(xLb, hLb, zLb, xLt, hLt, zLt, xRt, hRt, zRt, xRb, hRb, zRb)
				wallIdx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
				vi += 4
			}
		}
		const wallGeo = new THREE.BufferGeometry()
		wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3))
		wallGeo.setIndex(wallIdx)
		wallGeo.computeVertexNormals()
		const wallMesh = new THREE.Mesh(wallGeo, MAT.wallFill())
		wallMesh.renderOrder = 0
		group.add(wallMesh)
	}

	const outlineMat = new THREE.LineBasicMaterial({ color: 0x90c8ff })
	const defH = enclosure?.height_mm ?? 25

	// Lid
	{
		const lidPts = pts.map((v, i) => {
			const prof = edgeProfile(expandedZ[i], eBot, eTop, expandedZBot[i])
			const { off } = prof[prof.length - 1]
			return insetPt(v[0], v[1], off)
		})

		// Lid fill mesh
		{
			const lidShape = new THREE.Shape(lidPts.map(v => new THREE.Vector2(v[0], v[1])))
			const lidGeo = new THREE.ShapeGeometry(lidShape)
			lidGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))
			const pos = lidGeo.attributes.position
			for (let i = 0; i < pos.count; i++) {
				pos.setY(i, lidSampleHeight(pos.getX(i), pos.getZ(i), lidPts, expandedZ, heightGrid, defH))
			}
			pos.needsUpdate = true
			lidGeo.computeVertexNormals()
			const lidMesh = new THREE.Mesh(lidGeo, MAT.lidFill())
			lidMesh.renderOrder = 1
			group.add(lidMesh)
		}

		// Lid wireframe
		const lidLoopPts = lidPts.map((v, i) =>
			new THREE.Vector3(v[0], expandedZ[i] + 0.15, v[1])
		)
		lidLoopPts.push(lidLoopPts[0].clone())
		group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lidLoopPts), outlineMat))

		// Spoke lines
		if (cornerIndices.length >= 2) {
			const ocx = lidPts.reduce((s, v) => s + v[0], 0) / lidPts.length
			const ocy = lidPts.reduce((s, v) => s + v[1], 0) / lidPts.length
			const ch = lidSampleHeight(ocx, ocy, lidPts, expandedZ, heightGrid, defH) + 0.15
			const hub = new THREE.Vector3(ocx, ch, ocy)
			for (const ci of cornerIndices) {
				const v = lidPts[ci]
				const vh = expandedZ[ci] + 0.15
				group.add(new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						hub, new THREE.Vector3(v[0], vh, v[1]),
					]), outlineMat))
			}
		}

		// Component cutout rings
		const cutoutMat = new THREE.LineBasicMaterial({ color: 0xffdd66 })
		const RING_SEGS = 24
		const CLR = 0.5
		for (const comp of (compList ?? [])) {
			if (!comp.ui_placement) continue
			let x = comp.x_mm, y = comp.y_mm
			if (x == null || y == null) {
				const ui = uiPosMap[comp.instance_id]
				if (!ui) continue
				x = ui.x_mm; y = ui.y_mm
			}
			const body = comp.body
			if (!body) continue
			const rh = lidSampleHeight(x, y, lidPts, expandedZ, heightGrid, defH) + 0.2

			let ringPts: THREE.Vector3[]
			if (body.shape === 'circle') {
				const r = comp.cap_diameter_mm != null
					? (comp.cap_diameter_mm / 2 + (comp.cap_clearance_mm ?? CLR))
					: ((body.diameter_mm ?? 5) / 2 + CLR)
				ringPts = []
				for (let s = 0; s <= RING_SEGS; s++) {
					const a = (s / RING_SEGS) * Math.PI * 2
					ringPts.push(new THREE.Vector3(x + Math.cos(a) * r, rh, y + Math.sin(a) * r))
				}
			} else {
				const hw = ((body.width_mm ?? 6) / 2) + CLR
				const hh = ((body.length_mm ?? 6) / 2) + CLR
				ringPts = [
					new THREE.Vector3(x - hw, rh, y - hh),
					new THREE.Vector3(x + hw, rh, y - hh),
					new THREE.Vector3(x + hw, rh, y + hh),
					new THREE.Vector3(x - hw, rh, y + hh),
					new THREE.Vector3(x - hw, rh, y - hh),
				]
			}
			group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), cutoutMat))
		}
	}

	// Bottom wireframe loop
	const botLoopPts = pts.map((v, i) => {
		const prof = edgeProfile(expandedZ[i], eBot, eTop, expandedZBot[i])
		const [ix, iz] = insetPt(v[0], v[1], prof[0].off)
		return new THREE.Vector3(ix, prof[0].h, iz)
	})
	botLoopPts.push(botLoopPts[0].clone())
	group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(botLoopPts), outlineMat))

	// Vertical pillars
	const pillarSet = new Set(cornerIndices.length > 0 ? cornerIndices : [])
	pts.forEach((v, i) => {
		if (pillarSet.size > 0 ? !pillarSet.has(i) : (i % 7 !== 0)) return
		const prof = edgeProfile(expandedZ[i], eBot, eTop, expandedZBot[i])
		const pillarPts = prof.map(({ h, off }) => {
			const [ix, iz] = insetPt(v[0], v[1], off)
			return new THREE.Vector3(ix, h, iz)
		})
		group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pillarPts), outlineMat))
	})

	return group
}

function lidSampleHeight (x: number, y: number, boundaryPts: [number, number][], boundaryZ: number[], heightGrid: HeightGrid | null, defaultH: number): number {
	const gridZ = heightGrid ? gridSampleHeight(x, y, heightGrid) : null
	if (gridZ !== null) return gridZ

	let sumW = 0, sumWZ = 0
	for (let i = 0; i < boundaryPts.length; i++) {
		const d2 = (x - boundaryPts[i][0]) ** 2 + (y - boundaryPts[i][1]) ** 2
		if (d2 < 1e-6) return boundaryZ[i]
		const w = 1.0 / d2
		sumW += w
		sumWZ += w * boundaryZ[i]
	}
	return sumW > 0 ? sumWZ / sumW : defaultH
}

function gridSampleHeight (x: number, y: number, hg: HeightGrid): number | null {
	const fc = (x - hg.origin_x) / hg.step_mm
	const fr = (y - hg.origin_y) / hg.step_mm
	const c0 = Math.floor(fc), r0 = Math.floor(fr)
	const c1 = c0 + 1, r1 = r0 + 1
	const tc = fc - c0, tr = fr - r0

	const v = (r: number, c: number): number | null => {
		if (r < 0 || r >= hg.rows || c < 0 || c >= hg.cols) return null
		return hg.grid[r]?.[c] ?? null
	}

	const z00 = v(r0, c0), z10 = v(r0, c1), z01 = v(r1, c0), z11 = v(r1, c1)

	if (z00 != null && z10 != null && z01 != null && z11 != null) {
		return (1 - tr) * ((1 - tc) * z00 + tc * z10) + tr * ((1 - tc) * z01 + tc * z11)
	}

	let best: number | null = null, bestD = Infinity
	for (let dr = -1; dr <= 2; dr++) {
		for (let dc = -1; dc <= 2; dc++) {
			const val = v(r0 + dr, c0 + dc)
			if (val == null) continue
			const d = (dr - tr) * (dr - tr) + (dc - tc) * (dc - tc)
			if (d < bestD) { bestD = d; best = val }
		}
	}
	return best
}

function floorSampleHeight (x: number, y: number, boundaryPts: [number, number][], boundaryZBot: number[], bottomHeightGrid: HeightGrid | null): number {
	const gridZ = bottomHeightGrid ? gridSampleHeight(x, y, bottomHeightGrid) : null
	if (gridZ !== null) return gridZ

	if (!boundaryZBot) return 0
	let sumW = 0, sumWZ = 0
	for (let i = 0; i < boundaryPts.length; i++) {
		const d2 = (x - boundaryPts[i][0]) ** 2 + (y - boundaryPts[i][1]) ** 2
		if (d2 < 1e-6) return boundaryZBot[i]
		const w = 1.0 / d2
		sumW += w
		sumWZ += w * boundaryZBot[i]
	}
	return sumW > 0 ? sumWZ / sumW : 0
}

function buildPCBFloor (pts: [number, number][], expandedZBot: number[], bottomHeightGrid: HeightGrid | null): THREE.Group {
	const shape = new THREE.Shape(pts.map(v => new THREE.Vector2(v[0], v[1])))
	const geo = new THREE.ShapeGeometry(shape)
	geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))

	const FLOOR_THRESHOLD = 1.9
	const PCB_OFFSET = 0.5

	const hasVariableBot = expandedZBot && expandedZBot.some(z => z > 0.01)
	let useVertexColors = false

	if (hasVariableBot) {
		const pos = geo.attributes.position
		const colors = new Float32Array(pos.count * 3)
		const greenCol = new THREE.Color(0x1c3824)
		const greyCol = new THREE.Color(0x4a5868)

		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i)
			const z = pos.getZ(i)
			const h = floorSampleHeight(x, z, pts, expandedZBot, bottomHeightGrid)
			pos.setY(i, h + PCB_OFFSET)

			const col = h < FLOOR_THRESHOLD ? greenCol : greyCol
			colors[i * 3] = col.r
			colors[i * 3 + 1] = col.g
			colors[i * 3 + 2] = col.b
		}
		pos.needsUpdate = true
		geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
		geo.computeVertexNormals()
		useVertexColors = true
	} else {
		geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, PCB_OFFSET, 0))
	}

	const mat = useVertexColors
		? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 10, side: THREE.DoubleSide })
		: MAT.pcb()
	const mesh = new THREE.Mesh(geo, mat)

	const rimPts = pts.map((v, i) => {
		const bh = expandedZBot?.[i] ?? 0
		return new THREE.Vector3(v[0], bh + 0.6, v[1])
	})
	rimPts.push(rimPts[0].clone())
	const rimLine = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints(rimPts),
		new THREE.LineBasicMaterial({ color: 0x4a8a5a }),
	)

	const grp = new THREE.Group()
	grp.add(mesh)
	grp.add(rimLine)
	return grp
}

function buildComponentBox (
	comp: { x_mm?: number | null; y_mm?: number | null; rotation_deg?: number; body?: { shape?: string; width_mm?: number; length_mm?: number; height_mm?: number; diameter_mm?: number } },
	floorZ: number,
	colorHex: number
): THREE.Mesh | null {
	const body = comp.body
	if (!body) return null

	let W: number, L: number
	if (body.shape === 'cylinder' || body.shape === 'circle') {
		W = L = (body.diameter_mm ?? 5)
	} else {
		W = body.width_mm ?? 5
		L = body.length_mm ?? 5
	}
	const H = body.height_mm ?? 3

	const geo = new THREE.BoxGeometry(W, H, L)
	const mat = MAT.component(colorHex)
	const mesh = new THREE.Mesh(geo, mat)

	const x = comp.x_mm ?? 0
	const y = comp.y_mm ?? 0
	const rot = ((comp.rotation_deg ?? 0) * Math.PI) / 180

	mesh.position.set(x, floorZ + H / 2, y)
	mesh.rotation.y = -rot

	const edgeGeo = new THREE.EdgesGeometry(geo, 15)
	const edgeCol = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.45)
	const edgeLine = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: edgeCol }))
	mesh.add(edgeLine)

	return mesh
}

function buildTraceLine (trace: { path: [number, number][] }, floorZ: number, colorHex: number): THREE.Line | null {
	const path = trace.path
	if (!path || path.length < 2) return null

	const tpts = path.map(([x, y]) => new THREE.Vector3(x, floorZ, y))
	const geo = new THREE.BufferGeometry().setFromPoints(tpts)
	return new THREE.Line(geo, MAT.trace(colorHex))
}

function buildNetColorMap (netIds: string[]): Record<string, number> {
	const unique = [...new Set(netIds)]
	const n = unique.length
	const map: Record<string, number> = {}
	unique.forEach((id, i) => {
		const hue = (i * 360) / (n || 1)
		map[id] = new THREE.Color().setHSL(hue / 360, 0.75, 0.60).getHex()
	})
	return map
}
