'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

import { normalizeOutline } from '@/lib/viewport'
import { buildSceneContent } from '@/lib/scene3dBuilder'
import type { DesignSpec, PlacementResult, RoutingResult } from '@/types/models'

function cssColor (prop: string, fallback: string): THREE.Color {
	if (typeof document === 'undefined') return new THREE.Color(fallback)
	const v = getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
	if (!v) return new THREE.Color(fallback)
	const m = v.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/)
	if (m) {
		const c = new THREE.Color()
		c.setHSL(parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100, THREE.SRGBColorSpace)
		return c
	}
	try { return new THREE.Color(v) } catch { return new THREE.Color(fallback) }
}

interface Props {
	stlUrl?: string | null
	design?: DesignSpec | null
	placement?: PlacementResult | null
	routing?: RoutingResult | null
	className?: string
}

export default function Scene3D ({ stlUrl, design, placement, routing, className }: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const sceneRef = useRef<THREE.Scene | null>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const frameRef = useRef<number>(0)
	const needsFitRef = useRef(true)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const w = container.clientWidth || 400
		const h = container.clientHeight || 400

		const bg = cssColor('--color-surface', '#0d1117')
		const gridMain = bg.clone().lerp(new THREE.Color('#ffffff'), 0.08)
		const gridSub = bg.clone().lerp(new THREE.Color('#ffffff'), 0.04)

		const scene = new THREE.Scene()
		scene.background = bg
		scene.fog = new THREE.FogExp2(bg.getHex(), 0.0028)
		sceneRef.current = scene

		const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000)
		camera.position.set(50, 100, 150)
		camera.lookAt(0, 0, 0)
		cameraRef.current = camera

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
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

		scene.add(new THREE.AmbientLight(0xffffff, 0.80))
		const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
		dirLight.position.set(80, 250, 120)
		scene.add(dirLight)
		const fillLight = new THREE.DirectionalLight(0xaac8ff, 0.55)
		fillLight.position.set(-80, 60, -120)
		scene.add(fillLight)

		const grid = new THREE.GridHelper(400, 40, gridMain.getHex(), gridSub.getHex())
		grid.position.y = -0.5
		scene.add(grid)

		const animate = () => {
			frameRef.current = requestAnimationFrame(animate)
			controls.update()
			renderer.render(scene, camera)
		}
		animate()

		const onResize = () => {
			const nw = container.clientWidth
			const nh = container.clientHeight
			if (nw <= 0 || nh <= 0) return
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
		const camera = cameraRef.current
		if (!scene || !camera) return

		const toRemove = scene.children.filter(c => c.userData.dynamic)
		toRemove.forEach(c => {
			scene.remove(c)
			c.traverse(obj => {
				if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose()
				const mat = (obj as THREE.Mesh).material
				if (mat) {
					if (Array.isArray(mat)) mat.forEach(m => m.dispose())
					else mat.dispose()
				}
			})
		})
		needsFitRef.current = true

		if (stlUrl) {
			const loader = new STLLoader()
			loader.load(stlUrl, geometry => {
				geometry.computeVertexNormals()
				const mesh = new THREE.Mesh(
					geometry,
					new THREE.MeshPhongMaterial({ color: 0x8899bb, specular: 0xaabbcc, shininess: 30 })
				)
				mesh.rotation.x = -Math.PI / 2
				mesh.userData.dynamic = true
				scene.add(mesh)

				geometry.computeBoundingBox()
				const box = geometry.boundingBox!
				const center = new THREE.Vector3()
				box.getCenter(center)
				mesh.position.sub(center.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))
				fitCamera(scene, camera)
			})
			return
		}

		const data = routing ?? placement ?? design
		if (!data) return

		const outlineRaw = normalizeOutline(data.outline)
		if (outlineRaw.length < 3) return

		const contentGroup = buildSceneContent({
			outline: outlineRaw,
			enclosure: data.enclosure,
			height_grid: 'height_grid' in data ? (data as PlacementResult).height_grid : null,
			bottom_height_grid: 'bottom_height_grid' in data ? (data as PlacementResult).bottom_height_grid : null,
			components: 'components' in data ? data.components : [],
			ui_placements: 'ui_placements' in data ? (data as DesignSpec).ui_placements : [],
			traces: 'traces' in data ? (data as RoutingResult).traces : [],
		})
		contentGroup.userData.dynamic = true
		contentGroup.traverse(c => { c.userData.dynamic = true })
		scene.add(contentGroup)

		fitCamera(scene, camera)
	}, [stlUrl, design, placement, routing])

	function fitCamera (scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
		const box = new THREE.Box3()
		scene.children.filter(c => c.userData.dynamic).forEach(c => box.expandByObject(c))
		if (box.isEmpty()) return

		const center = box.getCenter(new THREE.Vector3())
		const size = box.getSize(new THREE.Vector3())
		const maxDim = Math.max(size.x, size.y, size.z)
		const dist = maxDim * 1.1 / Math.tan((camera.fov / 2) * Math.PI / 180)

		if (needsFitRef.current) {
			camera.position.set(center.x + dist * 0.65, center.y + dist * 0.50, center.z + dist * 0.85)
			camera.lookAt(center)
			controlsRef.current?.target.copy(center)
			controlsRef.current?.update()
			needsFitRef.current = false
		}
	}

	return <div ref={containerRef} className={className ?? 'w-full h-full'} />
}
