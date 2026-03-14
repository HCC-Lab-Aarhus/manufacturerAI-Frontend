'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

import { normaliseOutline, expandOutlineVertices, netColor } from '@/lib/viewport'
import type { PlacementResult, RoutingResult } from '@/types/models'

interface Props {
	stlUrl?: string | null
	placement?: PlacementResult | null
	routing?: RoutingResult | null
	className?: string
}

export default function Scene3D ({ stlUrl, placement, routing, className }: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const sceneRef = useRef<THREE.Scene | null>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const frameRef = useRef<number>(0)

	useEffect(() => {
		const container = containerRef.current
		if (!container) { return }

		const w = container.clientWidth
		const h = container.clientHeight

		const scene = new THREE.Scene()
		scene.background = new THREE.Color('#f0eeea')
		scene.fog = new THREE.Fog('#f0eeea', 300, 600)
		sceneRef.current = scene

		const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000)
		camera.position.set(60, 80, 100)
		cameraRef.current = camera

		const renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setSize(w, h)
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		container.appendChild(renderer.domElement)
		rendererRef.current = renderer

		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.dampingFactor = 0.08
		controlsRef.current = controls

		scene.add(new THREE.AmbientLight('#ffffff', 0.6))
		const dirLight = new THREE.DirectionalLight('#ffffff', 0.8)
		dirLight.position.set(50, 80, 60)
		scene.add(dirLight)

		scene.add(new THREE.GridHelper(200, 20, '#d6d2ca', '#e4e1db'))

		const animate = () => {
			frameRef.current = requestAnimationFrame(animate)
			controls.update()
			renderer.render(scene, camera)
		}
		animate()

		const onResize = () => {
			const nw = container.clientWidth
			const nh = container.clientHeight
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
			container.removeChild(renderer.domElement)
		}
	}, [])

	useEffect(() => {
		const scene = sceneRef.current
		const camera = cameraRef.current
		if (!scene || !camera) { return }

		const toRemove = scene.children.filter(c => c.userData.dynamic)
		toRemove.forEach(c => {
			scene.remove(c)
			if (c instanceof THREE.Mesh) { c.geometry.dispose() }
		})

		if (stlUrl) {
			const loader = new STLLoader()
			loader.load(stlUrl, geometry => {
				geometry.computeVertexNormals()
				const mesh = new THREE.Mesh(
					geometry,
					new THREE.MeshPhongMaterial({ color: '#8899bb', specular: '#aabbcc', shininess: 30, flatShading: false })
				)
				mesh.rotation.x = -Math.PI / 2
				mesh.userData.dynamic = true
				scene.add(mesh)

				geometry.computeBoundingBox()
				const box = geometry.boundingBox!
				const center = new THREE.Vector3()
				box.getCenter(center)
				mesh.position.sub(center.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))

				const size = new THREE.Vector3()
				box.getSize(size)
				const maxDim = Math.max(size.x, size.y, size.z)
				camera.position.set(maxDim, maxDim * 0.8, maxDim)
				camera.lookAt(0, 0, 0)
			})
			return
		}

		const data = routing ?? placement
		if (!data) { return }

		const outlineRaw = data.outline?.points ?? []
		if (outlineRaw.length < 3) { return }

		const enclosure = data.enclosure ?? { height_mm: 25 }
		const heightMm = enclosure.height_mm ?? 25
		const norm = normaliseOutline(outlineRaw)

		const { pts } = expandOutlineVertices(norm.verts, norm.corners, norm.zTops, heightMm, norm.zBottoms)

		const wallMat = new THREE.MeshPhongMaterial({ color: '#8899bb', transparent: true, opacity: 0.25, side: THREE.DoubleSide })
		const wallPts = pts.map(([x, y]) => new THREE.Vector2(x, y))
		const shape = new THREE.Shape(wallPts)
		const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: heightMm, bevelEnabled: false })
		const wallMesh = new THREE.Mesh(extrudeGeo, wallMat)
		wallMesh.rotation.x = -Math.PI / 2
		wallMesh.userData.dynamic = true
		scene.add(wallMesh)

		const wireGeo = new THREE.EdgesGeometry(extrudeGeo)
		const wireMat = new THREE.LineBasicMaterial({ color: '#5672a0', opacity: 0.4, transparent: true })
		const wire = new THREE.LineSegments(wireGeo, wireMat)
		wire.rotation.x = -Math.PI / 2
		wire.userData.dynamic = true
		scene.add(wire)

		const floorShape = new THREE.Shape(wallPts)
		const floorGeo = new THREE.ShapeGeometry(floorShape)
		const floorMat = new THREE.MeshPhongMaterial({ color: '#358045', transparent: true, opacity: 0.5, side: THREE.DoubleSide })
		const floor = new THREE.Mesh(floorGeo, floorMat)
		floor.rotation.x = -Math.PI / 2
		floor.position.y = 1.6
		floor.userData.dynamic = true
		scene.add(floor)

		const components = data.components ?? []
		components.forEach(c => {
			const bw = c.body?.width_mm ?? 5
			const bl = c.body?.length_mm ?? 5
			const bh = c.body?.height_mm ?? 3
			const geo = new THREE.BoxGeometry(bw, bh, bl)
			const mat = new THREE.MeshPhongMaterial({ color: '#6674a6' })
			const mesh = new THREE.Mesh(geo, mat)
			mesh.position.set(c.x_mm, 1.6 + bh / 2, -c.y_mm)
			mesh.userData.dynamic = true
			scene.add(mesh)

			const edgeGeo = new THREE.EdgesGeometry(geo)
			const edgeMat = new THREE.LineBasicMaterial({ color: '#333' })
			const edges = new THREE.LineSegments(edgeGeo, edgeMat)
			edges.position.copy(mesh.position)
			edges.userData.dynamic = true
			scene.add(edges)
		})

		if (routing) {
			const traces = routing.traces ?? []
			const uniqueNets = [...new Set(traces.map(t => t.net_id))]
			traces.forEach(trace => {
				const color = netColor(uniqueNets.indexOf(trace.net_id), uniqueNets.length)
				const points = trace.path.map(([x, y]) => new THREE.Vector3(x, 1.8, -y))
				const geo = new THREE.BufferGeometry().setFromPoints(points)
				const mat = new THREE.LineBasicMaterial({ color })
				const line = new THREE.Line(geo, mat)
				line.userData.dynamic = true
				scene.add(line)
			})
		}

		const box = new THREE.Box3()
		scene.children.filter(c => c.userData.dynamic).forEach(c => box.expandByObject(c))
		const center = new THREE.Vector3()
		box.getCenter(center)
		const size = new THREE.Vector3()
		box.getSize(size)
		const maxDim = Math.max(size.x, size.y, size.z) || 50
		camera.position.set(center.x + maxDim, center.y + maxDim * 0.7, center.z + maxDim)
		camera.lookAt(center)
		controlsRef.current?.target.copy(center)
	}, [stlUrl, placement, routing])

	return <div ref={containerRef} className={className ?? 'w-full h-full'} />
}
