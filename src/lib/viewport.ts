import type { Outline, OutlineVertex } from '@/types/models'

const SCALE = 4
const PAD = 40

export function normalizeOutline (raw: Outline | null | undefined): OutlineVertex[] {
	if (!raw) { return [] }
	if (Array.isArray(raw)) { return raw }
	if (Array.isArray(raw.points)) { return raw.points }
	return []
}

export function normalizeHoles (raw: Outline | null | undefined): OutlineVertex[][] {
	if (!raw || Array.isArray(raw)) { return [] }
	return raw.holes ?? []
}

export interface NormalisedOutline {
	verts: [number, number][]
	corners: { ease_in: number; ease_out: number }[]
}

export function normaliseOutline (outline: { x: number; y: number; ease_in?: number; ease_out?: number }[]): NormalisedOutline {
	if (!outline || !Array.isArray(outline)) return { verts: [], corners: [] }

	const verts = outline.map(p => [p.x, p.y] as [number, number])
	const corners = outline.map(p => {
		let ein = p.ease_in ?? null
		let eout = p.ease_out ?? null
		if (ein != null && eout == null) eout = ein
		if (eout != null && ein == null) ein = eout
		return { ease_in: ein ?? 0, ease_out: eout ?? 0 }
	})
	return { verts, corners }
}

export function expandOutlineVertices (
	verts: [number, number][],
	corners: { ease_in: number; ease_out: number }[],
	defaultZ: number,
	segs = 6
): { pts: [number, number][]; zs: number[]; zbots: number[]; cornerIndices: number[] } {
	const n = verts.length
	const pts: [number, number][] = []
	const zs: number[] = []
	const zbots: number[] = []
	const cornerIndices: number[] = []

	for (let i = 0; i < n; i++) {
		const prev = (i - 1 + n) % n
		const next = (i + 1) % n
		const C = verts[i], P = verts[prev], N = verts[next]
		const eIn = corners[i].ease_in ?? 0
		const eOut = corners[i].ease_out ?? 0

		if (eIn === 0 && eOut === 0) {
			cornerIndices.push(pts.length)
			pts.push(C); zs.push(defaultZ); zbots.push(0)
			continue
		}

		const dPx = P[0] - C[0], dPy = P[1] - C[1]
		const dNx = N[0] - C[0], dNy = N[1] - C[1]
		const lenP = Math.hypot(dPx, dPy)
		const lenN = Math.hypot(dNx, dNy)
		if (lenP === 0 || lenN === 0) {
			cornerIndices.push(pts.length)
			pts.push(C); zs.push(defaultZ); zbots.push(0)
			continue
		}

		const safeIn = Math.min(eIn, lenP * 0.45)
		const safeOut = Math.min(eOut, lenN * 0.45)
		const tIn = safeIn / lenP
		const tOut = safeOut / lenN
		const A: [number, number] = [C[0] + dPx * tIn, C[1] + dPy * tIn]
		const B: [number, number] = [C[0] + dNx * tOut, C[1] + dNy * tOut]

		cornerIndices.push(pts.length + Math.floor(segs / 2))

		for (let s = 0; s <= segs; s++) {
			const t = s / segs
			const u = 1 - t
			const x = u * u * A[0] + 2 * u * t * C[0] + t * t * B[0]
			const y = u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]
			pts.push([x, y]); zs.push(defaultZ); zbots.push(0)
		}
	}

	return { pts, zs, zbots, cornerIndices }
}

export function buildOutlinePath (outline: { x: number; y: number; ease_in?: number; ease_out?: number }[], holes?: { x: number; y: number; ease_in?: number; ease_out?: number }[][]): string {
	const norm = normaliseOutline(outline)
	const { verts, corners } = norm
	const n = verts.length
	if (n < 3) return ''

	const parts: string[] = []
	for (let i = 0; i < n; i++) {
		const C = verts[i]
		const prev = (i - 1 + n) % n
		const next = (i + 1) % n
		const P = verts[prev], N = verts[next]
		const eIn = corners[i].ease_in ?? 0
		const eOut = corners[i].ease_out ?? 0

		if (eIn === 0 && eOut === 0) {
			parts.push(i === 0 ? `M${C[0] * SCALE},${C[1] * SCALE}` : `L${C[0] * SCALE},${C[1] * SCALE}`)
			continue
		}

		const dPx = P[0] - C[0], dPy = P[1] - C[1]
		const dNx = N[0] - C[0], dNy = N[1] - C[1]
		const lenP = Math.hypot(dPx, dPy)
		const lenN = Math.hypot(dNx, dNy)
		const tIn = Math.min(eIn / lenP, 0.5)
		const tOut = Math.min(eOut / lenN, 0.5)
		const ax = (C[0] + dPx * tIn) * SCALE
		const ay = (C[1] + dPy * tIn) * SCALE
		const bx = (C[0] + dNx * tOut) * SCALE
		const by = (C[1] + dNy * tOut) * SCALE

		if (i === 0) parts.push(`M${ax},${ay}`)
		else parts.push(`L${ax},${ay}`)
		parts.push(`Q${C[0] * SCALE},${C[1] * SCALE} ${bx},${by}`)
	}
	parts.push('Z')

	if (holes) {
		for (const hole of holes) {
			const hn = normaliseOutline(hole)
			const hv = hn.verts, hc = hn.corners
			if (hv.length < 3) continue
			for (let i = 0; i < hv.length; i++) {
				const C = hv[i]
				const prev = (i - 1 + hv.length) % hv.length
				const next = (i + 1) % hv.length
				const P = hv[prev], N = hv[next]
				const eIn = hc[i].ease_in ?? 0
				const eOut = hc[i].ease_out ?? 0

				if (eIn === 0 && eOut === 0) {
					parts.push(i === 0 ? `M${C[0] * SCALE},${C[1] * SCALE}` : `L${C[0] * SCALE},${C[1] * SCALE}`)
					continue
				}

				const dPx = P[0] - C[0], dPy = P[1] - C[1]
				const dNx = N[0] - C[0], dNy = N[1] - C[1]
				const lenP = Math.hypot(dPx, dPy)
				const lenN = Math.hypot(dNx, dNy)
				const tIn = Math.min(eIn / lenP, 0.5)
				const tOut = Math.min(eOut / lenN, 0.5)
				const ax = (C[0] + dPx * tIn) * SCALE
				const ay = (C[1] + dPy * tIn) * SCALE
				const bx = (C[0] + dNx * tOut) * SCALE
				const by = (C[1] + dNy * tOut) * SCALE

				if (i === 0) parts.push(`M${ax},${ay}`)
				else parts.push(`L${ax},${ay}`)
				parts.push(`Q${C[0] * SCALE},${C[1] * SCALE} ${bx},${by}`)
			}
			parts.push('Z')
		}
	}

	return parts.join(' ')
}

export function outlineBBox (outline: { x: number; y: number }[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
	const xs = outline.map(p => p.x)
	const ys = outline.map(p => p.y)
	const minX = Math.min(...xs)
	const minY = Math.min(...ys)
	const maxX = Math.max(...xs)
	const maxY = Math.max(...ys)
	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export function svgViewBox (outline: { x: number; y: number }[]): string {
	const { minX, minY, width, height } = outlineBBox(outline)
	return `${minX * SCALE - PAD} ${minY * SCALE - PAD} ${width * SCALE + PAD * 2} ${height * SCALE + PAD * 2}`
}

export function netColor (index: number, total: number): string {
	const hue = (index * 360 / Math.max(total, 1)) % 360
	return `hsl(${hue}, 70%, 50%)`
}

export { SCALE, PAD }

export function snapToEdge (
	up: { x_mm: number; y_mm: number; edge_index?: number | null },
	verts: [number, number][],
	defaultZ = 25
): { x: number; y: number; z: number; rot: number } {
	const n = verts.length
	const i = up.edge_index ?? 0
	const v0 = verts[i]
	const v1 = verts[(i + 1) % n]

	const ex = v1[0] - v0[0]
	const ey = v1[1] - v0[1]
	const edgeLen = Math.hypot(ex, ey)
	if (edgeLen === 0) return { x: up.x_mm, y: up.y_mm, z: defaultZ, rot: 0 }

	const dx = ex / edgeLen
	const dy = ey / edgeLen
	const px = up.x_mm - v0[0]
	const py = up.y_mm - v0[1]
	let t = (px * dx + py * dy) / edgeLen
	t = Math.max(0, Math.min(1, t))

	const x = v0[0] + t * ex
	const y = v0[1] + t * ey
	const z = defaultZ
	const angle = Math.atan2(ey, ex) * 180 / Math.PI
	const normalAngle = angle - 90
	const rot = ((Math.round(normalAngle / 90) * 90) % 360 + 360) % 360

	return { x, y, z, rot }
}

export function nearestEdge (x: number, y: number, verts: [number, number][]): { edgeIndex: number; t: number; snapX: number; snapY: number; dist: number } {
	let best = { edgeIndex: 0, t: 0.5, snapX: x, snapY: y, dist: Infinity }
	const n = verts.length
	for (let i = 0; i < n; i++) {
		const v0 = verts[i], v1 = verts[(i + 1) % n]
		const ex = v1[0] - v0[0], ey = v1[1] - v0[1]
		const lenSq = ex * ex + ey * ey
		if (lenSq < 1e-12) continue
		let t = ((x - v0[0]) * ex + (y - v0[1]) * ey) / lenSq
		t = Math.max(0, Math.min(1, t))
		const sx = v0[0] + t * ex, sy = v0[1] + t * ey
		const d = Math.hypot(x - sx, y - sy)
		if (d < best.dist) {
			best = { edgeIndex: i, t, snapX: sx, snapY: sy, dist: d }
		}
	}
	return best
}
