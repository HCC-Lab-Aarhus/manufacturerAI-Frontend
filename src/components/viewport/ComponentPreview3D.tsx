'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { useTheme } from '@/contexts/ThemeContext'
import type { CatalogComponent } from '@/types/models'

const PIN_COLORS: Record<string, number> = { in: 0x3b82f6, out: 0xef4444, bidirectional: 0xeab308 }
const BODY_COLOR = 0x555555
const CAP_COLOR = 0x888888
const BLOCKER_COLOR = 0xe74c3c
const FEATURE_COLOR = 0xf59e0b
const FEATURE_THRU_COLOR = 0x22d3ee
const HIGHLIGHT_COLOR = 0x00ff88

function cssColor (prop: string, fallback: string): THREE.Color {
	if (typeof document === 'undefined') { return new THREE.Color(fallback) }
	const v = getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
	if (!v) { return new THREE.Color(fallback) }
	const m = v.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/)
	if (m) {
		const c = new THREE.Color()
		c.setHSL(parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100, THREE.SRGBColorSpace)
		return c
	}
	try { return new THREE.Color(v) } catch { return new THREE.Color(fallback) }
}

function buildComponent (comp: CatalogComponent): THREE.Group {
	const group = new THREE.Group()
	const { body, pins, mounting } = comp

	const bodyMat = new THREE.MeshPhongMaterial({ color: BODY_COLOR, specular: 0x222222, shininess: 40, transparent: true, opacity: 0.85 })

	if (body.shape === 'circle') {
		const r = (body.diameter_mm ?? 5) / 2
		const h = body.height_mm
		const geo = new THREE.CylinderGeometry(r, r, h, 32)
		const mesh = new THREE.Mesh(geo, bodyMat)
		mesh.position.y = h / 2
		group.add(mesh)
	} else {
		const w = body.width_mm ?? 10
		const l = body.length_mm ?? 10
		const h = body.height_mm
		const geo = new THREE.BoxGeometry(w, h, l)
		const mesh = new THREE.Mesh(geo, bodyMat)
		mesh.position.y = h / 2
		group.add(mesh)
	}

	if (mounting.cap) {
		const capR = mounting.cap.diameter_mm / 2
		const capH = mounting.cap.height_mm
		const capGeo = new THREE.CylinderGeometry(capR, capR, capH, 32)
		const capMat = new THREE.MeshPhongMaterial({ color: CAP_COLOR, specular: 0x333333, shininess: 60, transparent: true, opacity: 0.5 })
		const capMesh = new THREE.Mesh(capGeo, capMat)
		capMesh.position.y = body.height_mm + capH / 2
		group.add(capMesh)
	}

	for (const pin of pins) {
		const [px, pz] = pin.position_mm
		const color = PIN_COLORS[pin.direction] ?? 0x888888
		const pinMat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 })

		const pinH = body.height_mm + 2
		const isRect = pin.shape?.type === 'rect' && pin.shape.width_mm && pin.shape.length_mm
		let pinGeo: THREE.BufferGeometry
		if (isRect) {
			pinGeo = new THREE.BoxGeometry(pin.shape!.width_mm!, pinH, pin.shape!.length_mm!)
		} else {
			const pinR = pin.hole_diameter_mm / 2
			pinGeo = new THREE.CylinderGeometry(pinR, pinR, pinH, 12)
		}
		const pinMesh = new THREE.Mesh(pinGeo, pinMat)
		pinMesh.position.set(px, pinH / 2 - 1, pz)
		group.add(pinMesh)
	}

	const scadMat = new THREE.MeshPhongMaterial({ color: FEATURE_COLOR, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
	const scadThruMat = new THREE.MeshPhongMaterial({ color: FEATURE_THRU_COLOR, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
	if (comp.scad?.features) {
		for (let fi = 0; fi < comp.scad.features.length; fi++) {
			const feat = comp.scad.features[fi]
			const [fx, fz] = feat.position_mm
			const isThru = feat.through_surface ?? false
			const depth = isThru ? 2.0 : (feat.depth_mm ?? 0.5)
			let mesh: THREE.Mesh

			if (feat.shape === 'circle') {
				const r = (feat.diameter_mm ?? 1) / 2
				const geo = new THREE.CylinderGeometry(r, r, depth, 24)
				mesh = new THREE.Mesh(geo, isThru ? scadThruMat : scadMat)
			} else {
				const w = feat.width_mm ?? 1
				const l = feat.length_mm ?? 1
				const geo = new THREE.BoxGeometry(w, depth, l)
				mesh = new THREE.Mesh(geo, isThru ? scadThruMat : scadMat)
			}

			const anchor = feat.z_anchor ?? 'cavity_start'
			let yBase: number
			if (anchor === 'ground') {
				yBase = 0
			} else if (anchor === 'floor') {
				yBase = isThru ? -depth : 0
			} else if (anchor === 'cavity_start') {
				yBase = 0
			} else {
				yBase = body.height_mm - depth
			}
			mesh.position.set(fx, yBase + depth / 2, fz)
			mesh.userData.featureIndex = fi
			group.add(mesh)
		}
	}

	const blockerMat = new THREE.MeshPhongMaterial({ color: BLOCKER_COLOR, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
	const blockerEdgeMat = new THREE.LineBasicMaterial({ color: BLOCKER_COLOR, transparent: true, opacity: 0.6 })
	if (comp.support_blockers) {
		for (const blk of comp.support_blockers) {
			const [bx, bz] = blk.position_mm
			const h = blk.height_mm
			let blkMesh: THREE.Mesh

			if (blk.shape === 'circle') {
				const r = (blk.diameter_mm ?? 1) / 2
				const geo = new THREE.CylinderGeometry(r, r, h, 24)
				blkMesh = new THREE.Mesh(geo, blockerMat)
				const edges = new THREE.EdgesGeometry(geo)
				const wire = new THREE.LineSegments(edges, blockerEdgeMat)
				blkMesh.add(wire)
			} else {
				const w = blk.width_mm ?? 1
				const l = blk.length_mm ?? 1
				const geo = new THREE.BoxGeometry(w, h, l)
				blkMesh = new THREE.Mesh(geo, blockerMat)
				const edges = new THREE.EdgesGeometry(geo)
				const wire = new THREE.LineSegments(edges, blockerEdgeMat)
				blkMesh.add(wire)
			}

			const anchor = blk.z_anchor ?? 'cavity_start'
			let yBase: number
			if (anchor === 'ground') {
				yBase = 0
			} else if (anchor === 'floor') {
				yBase = 0
			} else if (anchor === 'ceil_start') {
				yBase = body.height_mm - h
			} else {
				yBase = body.height_mm - h
			}
			blkMesh.position.set(bx, yBase + h / 2, bz)
			group.add(blkMesh)
		}
	}

	return group
}

interface Props {
	component: CatalogComponent
	className?: string
	highlightedFeature?: number | null
}

export default function ComponentPreview3D ({ component, className, highlightedFeature }: Props) {
	const { color: themeColor } = useTheme()
	const containerRef = useRef<HTMLDivElement>(null)
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const sceneRef = useRef<THREE.Scene | null>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const gridRef = useRef<THREE.GridHelper | null>(null)
	const frameRef = useRef<number>(0)

	useEffect(() => {
		const container = containerRef.current
		if (!container) { return }

		const w = container.clientWidth || 300
		const h = container.clientHeight || 300

		const bg = cssColor('--color-surface', '#0d1117')
		const gridMain = bg.clone().lerp(new THREE.Color('#ffffff'), 0.08)
		const gridSub = bg.clone().lerp(new THREE.Color('#ffffff'), 0.04)

		const scene = new THREE.Scene()
		scene.background = bg
		sceneRef.current = scene

		const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
		cameraRef.current = camera

		const renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setClearColor(bg.getHex(), 1)
		renderer.setSize(w, h)
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		container.appendChild(renderer.domElement)
		rendererRef.current = renderer

		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.dampingFactor = 0.08
		controls.update()
		controlsRef.current = controls

		scene.add(new THREE.AmbientLight(0xffffff, 0.85))
		const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
		dirLight.position.set(40, 80, 60)
		scene.add(dirLight)
		const fillLight = new THREE.DirectionalLight(0xaac8ff, 0.4)
		fillLight.position.set(-40, 30, -60)
		scene.add(fillLight)

		const grid = new THREE.GridHelper(100, 20, gridMain.getHex(), gridSub.getHex())
		grid.position.y = -0.2
		scene.add(grid)
		gridRef.current = grid

		const animate = () => {
			frameRef.current = requestAnimationFrame(animate)
			controls.update()
			renderer.render(scene, camera)
		}
		animate()

		const onResize = () => {
			const nw = container.clientWidth
			const nh = container.clientHeight
			if (nw <= 0 || nh <= 0) { return }
			camera.aspect = nw / nh
			camera.updateProjectionMatrix()
			renderer.setSize(nw, nh)
		}
		window.addEventListener('resize', onResize)

		return () => {
			cancelAnimationFrame(frameRef.current)
			window.removeEventListener('resize', onResize)
			controls.dispose()
			renderer.dispose()
			if (renderer.domElement.parentNode === container) {
				container.removeChild(renderer.domElement)
			}
		}
	}, [])

	useEffect(() => {
		const scene = sceneRef.current
		const renderer = rendererRef.current
		const oldGrid = gridRef.current
		if (!scene || !renderer) { return }

		const bg = cssColor('--color-surface', '#0d1117')
		scene.background = bg
		renderer.setClearColor(bg.getHex(), 1)

		if (oldGrid) {
			scene.remove(oldGrid)
			oldGrid.geometry.dispose()
			if (Array.isArray(oldGrid.material)) {
				oldGrid.material.forEach(m => m.dispose())
			} else {
				oldGrid.material.dispose()
			}
		}
		const gridMain = bg.clone().lerp(new THREE.Color('#ffffff'), 0.08)
		const gridSub = bg.clone().lerp(new THREE.Color('#ffffff'), 0.04)
		const grid = new THREE.GridHelper(100, 20, gridMain.getHex(), gridSub.getHex())
		grid.position.y = -0.2
		scene.add(grid)
		gridRef.current = grid
	}, [themeColor])

	useEffect(() => {
		const scene = sceneRef.current
		const camera = cameraRef.current
		if (!scene || !camera) { return }

		const toRemove = scene.children.filter(c => c.userData.dynamic)
		toRemove.forEach(c => {
			scene.remove(c)
			c.traverse(obj => {
				if ((obj as THREE.Mesh).geometry) { (obj as THREE.Mesh).geometry.dispose() }
				const mat = (obj as THREE.Mesh).material
				if (mat) {
					if (Array.isArray(mat)) {
						mat.forEach(m => m.dispose())
					} else {
						mat.dispose()
					}
				}
			})
		})

		const group = buildComponent(component)
		group.userData.dynamic = true
		group.traverse(c => { c.userData.dynamic = true })
		scene.add(group)

		const box = new THREE.Box3().expandByObject(group)
		if (box.isEmpty()) { return }
		const center = box.getCenter(new THREE.Vector3())
		const size = box.getSize(new THREE.Vector3())
		const maxDim = Math.max(size.x, size.y, size.z)
		const dist = maxDim * 1.6 / Math.tan((camera.fov / 2) * Math.PI / 180)

		camera.position.set(center.x + dist * 0.55, center.y + dist * 0.45, center.z + dist * 0.7)
		camera.lookAt(center)
		controlsRef.current?.target.copy(center)
		controlsRef.current?.update()
	}, [component])

	useEffect(() => {
		const scene = sceneRef.current
		if (!scene) return
		const highlightMat = new THREE.MeshPhongMaterial({ color: HIGHLIGHT_COLOR, emissive: HIGHLIGHT_COLOR, emissiveIntensity: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
		const scadMat = new THREE.MeshPhongMaterial({ color: FEATURE_COLOR, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
		const scadThruMat = new THREE.MeshPhongMaterial({ color: FEATURE_THRU_COLOR, transparent: true, opacity: 0.5, side: THREE.DoubleSide })

		scene.traverse(obj => {
			if (!(obj instanceof THREE.Mesh) || obj.userData.featureIndex === undefined) return
			const fi = obj.userData.featureIndex as number
			if (highlightedFeature != null && fi === highlightedFeature) {
				obj.material = highlightMat
			} else {
				const feat = component.scad?.features?.[fi]
				obj.material = (feat?.through_surface) ? scadThruMat : scadMat
			}
		})
		return () => {
			highlightMat.dispose()
			scadMat.dispose()
			scadThruMat.dispose()
		}
	}, [highlightedFeature, component])

	return <div ref={containerRef} className={className ?? 'h-64 w-full rounded-xl overflow-hidden'} />
}
