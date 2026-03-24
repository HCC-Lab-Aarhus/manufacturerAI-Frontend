'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { normalizeOutline } from '@/lib/viewport'
import { buildSceneContent } from '@/lib/scene3dBuilder'
import { useTheme } from '@/contexts/ThemeContext'
import { useSimulation } from '@/hooks/useSimulation'
import type { PlacementResult } from '@/types/models'
import type { SimConfig } from '@/lib/api/setup'

/* ── colour helpers ──────────────────────────────────────────────── */

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

/* ── types ────────────────────────────────────────────────────────── */

interface Props {
	placement: PlacementResult
	simConfig: SimConfig
	sessionId: string
	className?: string
}

/* ── component ────────────────────────────────────────────────────── */

export default function DeviceSimulator ({ placement, simConfig, sessionId, className }: Props) {
	const { color: themeColor } = useTheme()
	const { peripheralState, serialLog, status, error, press, release, start, stop, restart, clearLog } = useSimulation(sessionId, simConfig)
	const serialEndRef = useRef<HTMLDivElement>(null)

	// Refs for Three.js objects
	const containerRef = useRef<HTMLDivElement>(null)
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const sceneRef = useRef<THREE.Scene | null>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const frameRef = useRef(0)

	// Interactive mesh tracking
	const buttonMeshes = useRef<Map<string, THREE.Mesh>>(new Map())
	const ledMeshes = useRef<Map<string, THREE.Mesh>>(new Map())
	const raycaster = useRef(new THREE.Raycaster())
	const pointer = useRef(new THREE.Vector2())

	// Keep a ref of peripheralState to avoid re-attaching pointer listeners on every pin change
	const peripheralStateRef = useRef(peripheralState)
	useEffect(() => { peripheralStateRef.current = peripheralState }, [peripheralState])

	// Auto-scroll serial log
	useEffect(() => {
		serialEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [serialLog])

	// ── Three.js setup ──────────────────────────────────────────────
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const w = container.clientWidth || 400
		const h = container.clientHeight || 400

		const bg = cssColor('--color-surface', '#0d1117')

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

		const gridMain = bg.clone().lerp(new THREE.Color('#ffffff'), 0.08)
		const gridSub = bg.clone().lerp(new THREE.Color('#ffffff'), 0.04)
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

	// ── Update theme colours ────────────────────────────────────────
	useEffect(() => {
		const scene = sceneRef.current
		const renderer = rendererRef.current
		if (!scene || !renderer) return
		const bg = cssColor('--color-surface', '#0d1117')
		scene.background = bg
		if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(bg)
		renderer.setClearColor(bg.getHex(), 1)
	}, [themeColor])

	// ── Build scene content from placement ──────────────────────────
	useEffect(() => {
		const scene = sceneRef.current
		const camera = cameraRef.current
		if (!scene || !camera) return

		// Remove old dynamic children
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
		buttonMeshes.current.clear()
		ledMeshes.current.clear()

		const outlineRaw = normalizeOutline(placement.outline)
		if (outlineRaw.length < 3) return

		// Build base scene (enclosure + PCB + components)
		const contentGroup = buildSceneContent({
			outline: outlineRaw,
			enclosure: placement.enclosure,
			height_grid: placement.height_grid,
			components: placement.components,
			ui_placements: [],
			traces: [],
		})
		contentGroup.userData.dynamic = true
		contentGroup.traverse(c => { c.userData.dynamic = true })
		scene.add(contentGroup)

		// Build the interactive peripheral set by creating per-component ID sets
		const buttonIds = new Set(simConfig.peripherals.filter(p => p.type === 'button').map(p => p.instance_id))
		const ledIds = new Set(simConfig.peripherals.filter(p => p.type === 'led' || p.type === 'ir_output').map(p => p.instance_id))

		// Walk placement components and find the meshes we created, or create labelled overlays
		const FLOOR_Z = 2
		for (const comp of placement.components) {
			const iid = comp.instance_id
			const x = comp.x_mm
			const y = comp.y_mm
			if (x == null || y == null) continue

			const body = comp.body
			if (!body) continue

			let W: number, L: number
			if (body.shape === 'circle') {
				W = L = (body.diameter_mm ?? 5)
			} else {
				W = body.width_mm ?? 5
				L = body.length_mm ?? 5
			}
			const H = body.height_mm ?? 3

			if (buttonIds.has(iid)) {
				// Create clickable button mesh
				const geo = new THREE.BoxGeometry(W + 1, H + 0.5, L + 1)
				const mat = new THREE.MeshPhongMaterial({
					color: 0x556677,
					shininess: 80,
					transparent: true,
					opacity: 0.7,
				})
				const mesh = new THREE.Mesh(geo, mat)
				mesh.position.set(x, FLOOR_Z + H / 2, y)
				mesh.userData = { dynamic: true, instance_id: iid, peripheral: 'button' }
				scene.add(mesh)
				buttonMeshes.current.set(iid, mesh)

				// Label
				addLabel(scene, iid, x, FLOOR_Z + H + 2, y)
			}

			if (ledIds.has(iid)) {
				// Create LED glow mesh (sphere)
				const periph = simConfig.peripherals.find(p => p.instance_id === iid)
				const isIR = periph?.type === 'ir_output'
				const radius = Math.max(W, L) / 2 + 0.5
				const geo = new THREE.SphereGeometry(radius, 16, 16)
				const mat = new THREE.MeshPhongMaterial({
					color: isIR ? 0x880044 : 0x44ff44,
					emissive: 0x000000,
					transparent: true,
					opacity: 0.5,
					shininess: 100,
				})
				const mesh = new THREE.Mesh(geo, mat)
				mesh.position.set(x, FLOOR_Z + H / 2, y)
				mesh.userData = { dynamic: true, instance_id: iid, peripheral: isIR ? 'ir_output' : 'led' }
				scene.add(mesh)
				ledMeshes.current.set(iid, mesh)

				// Label
				addLabel(scene, iid, x, FLOOR_Z + H + 2, y)
			}
		}

		// Fit camera
		const box = new THREE.Box3()
		scene.children.filter(c => c.userData.dynamic).forEach(c => box.expandByObject(c))
		if (!box.isEmpty()) {
			const center = box.getCenter(new THREE.Vector3())
			const size = box.getSize(new THREE.Vector3())
			const maxDim = Math.max(size.x, size.y, size.z)
			const dist = maxDim * 1.1 / Math.tan((camera.fov / 2) * Math.PI / 180)
			camera.position.set(center.x + dist * 0.65, center.y + dist * 0.50, center.z + dist * 0.85)
			camera.lookAt(center)
			controlsRef.current?.target.copy(center)
			controlsRef.current?.update()
		}
	}, [placement, simConfig])

	// ── Update LED glow based on peripheral state ───────────────────
	useEffect(() => {
		for (const [iid, mesh] of ledMeshes.current) {
			const state = peripheralState[iid]
			const mat = mesh.material as THREE.MeshPhongMaterial
			if (state?.on) {
				const periph = simConfig.peripherals.find(p => p.instance_id === iid)
				const isIR = periph?.type === 'ir_output'
				mat.emissive.set(isIR ? 0xff0066 : 0x00ff44)
				mat.emissiveIntensity = 2.0
				mat.opacity = 0.9
			} else {
				mat.emissive.set(0x000000)
				mat.emissiveIntensity = 0
				mat.opacity = 0.5
			}
		}
	}, [peripheralState, simConfig])

	// ── Button press visual feedback ────────────────────────────────
	const applyButtonVisual = useCallback((buttonId: string, pressed: boolean) => {
		const mesh = buttonMeshes.current.get(buttonId)
		if (mesh) {
			const mat = mesh.material as THREE.MeshPhongMaterial
			if (pressed) {
				mesh.position.y -= 0.5
				mat.color.set(0x88aacc)
				mat.opacity = 0.9
			} else {
				mesh.position.y += 0.5
				mat.color.set(0x556677)
				mat.opacity = 0.7
			}
		}
	}, [])

	// ── Raycasting: mouse events for button interaction ─────────────
	useEffect(() => {
		const container = containerRef.current
		const renderer = rendererRef.current
		if (!container || !renderer) return

		const onPointerDown = (e: PointerEvent) => {
			const rect = renderer.domElement.getBoundingClientRect()
			pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
			pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

			const camera = cameraRef.current
			if (!camera) return

			raycaster.current.setFromCamera(pointer.current, camera)
			const meshes = Array.from(buttonMeshes.current.values())
			const hits = raycaster.current.intersectObjects(meshes, false)

			if (hits.length > 0) {
				const iid = hits[0].object.userData.instance_id as string
				if (iid) {
					press(iid)
					applyButtonVisual(iid, true)
				}
			}
		}

		const onPointerUp = () => {
			for (const [iid, state] of Object.entries(peripheralStateRef.current)) {
				if (state.pressed) {
					release(iid)
					applyButtonVisual(iid, false)
				}
			}
		}

		renderer.domElement.addEventListener('pointerdown', onPointerDown)
		renderer.domElement.addEventListener('pointerup', onPointerUp)
		renderer.domElement.addEventListener('pointerleave', onPointerUp)

		return () => {
			renderer.domElement.removeEventListener('pointerdown', onPointerDown)
			renderer.domElement.removeEventListener('pointerup', onPointerUp)
			renderer.domElement.removeEventListener('pointerleave', onPointerUp)
		}
	}, [press, release, applyButtonVisual])

	// Build the status bar string
	const buttons = simConfig.peripherals.filter(p => p.type === 'button')
	const outputs = simConfig.peripherals.filter(p => p.type === 'led' || p.type === 'ir_output')

	const statusLabel: Record<string, string> = {
		disconnected: 'Disconnected',
		connecting: 'Connecting…',
		connected: 'Connected',
		booted: 'Running',
		stopped: 'Stopped',
		error: error ?? 'Error',
	}

	const statusColor: Record<string, string> = {
		disconnected: 'bg-fg-muted/30',
		connecting: 'bg-yellow-400',
		connected: 'bg-yellow-400',
		booted: 'bg-green-400',
		stopped: 'bg-red-400',
		error: 'bg-red-400',
	}

	const isRunning = status === 'booted' || status === 'connecting' || status === 'connected'

	return (
		<div className={`flex flex-col ${className ?? 'w-full h-full'}`}>
			{/* Status bar */}
			<div className="flex items-center gap-3 border-b border-border px-3 py-1.5 bg-surface-alt text-xs">
				<span className="text-fg-muted font-medium">Simulator</span>
				<span className="flex items-center gap-1.5 text-fg-secondary">
					<span className={`inline-block h-2 w-2 rounded-full ${statusColor[status]}`} />
					{statusLabel[status]}
				</span>
				<span className="text-fg-secondary">
					{buttons.length} button{buttons.length !== 1 ? 's' : ''} · {outputs.length} output{outputs.length !== 1 ? 's' : ''}
				</span>
				<div className="ml-auto flex items-center gap-1">
					{!isRunning && (
						<button onClick={start} className="rounded px-2 py-0.5 text-[11px] font-medium bg-surface-chip text-fg hover:bg-accent/20 transition-colors" title="Start">▶</button>
					)}
					{isRunning && (
						<button onClick={stop} className="rounded px-2 py-0.5 text-[11px] font-medium bg-surface-chip text-fg hover:bg-error/20 transition-colors" title="Stop">⏹</button>
					)}
					<button onClick={restart} className="rounded px-2 py-0.5 text-[11px] font-medium bg-surface-chip text-fg hover:bg-accent/20 transition-colors" title="Restart">↻</button>
				</div>
			</div>
			{/* 3D viewport */}
			<div ref={containerRef} className="flex-1 min-h-0" />
			{/* Peripheral state panel */}
			<div className="flex flex-wrap gap-2 border-t border-border px-3 py-2 bg-surface-alt">
				{simConfig.peripherals.map(p => {
					const state = peripheralState[p.instance_id]
					const isActive = p.type === 'button' ? state?.pressed : state?.on
					return (
						<div
							key={p.instance_id}
							className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono transition-colors ${
								isActive
									? 'bg-accent/20 text-accent-text'
									: 'bg-surface-chip text-fg-secondary'
							}`}
						>
							<span className={`inline-block h-2 w-2 rounded-full ${
								isActive
									? p.type === 'ir_output' ? 'bg-purple-400' : p.type === 'led' ? 'bg-green-400' : 'bg-accent'
									: 'bg-fg-muted/30'
							}`} />
							<span>{p.instance_id}</span>
							<span className="text-fg-muted">{p.type}</span>
						</div>
					)
				})}
			</div>
			{/* Serial log */}
			<div className="border-t border-border bg-[#0a0e14] flex flex-col max-h-[30%] min-h-20">
				<div className="flex items-center justify-between px-3 py-1 bg-surface-alt border-b border-border">
					<span className="text-[11px] font-medium text-fg-muted">Serial Monitor</span>
					<button onClick={clearLog} className="text-[10px] text-fg-muted hover:text-fg transition-colors" title="Clear log">🗑</button>
				</div>
				<div className="flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] text-[#8cc265] leading-relaxed">
					{serialLog.length === 0 ? (
						<span className="text-fg-muted/40 italic">No serial output yet</span>
					) : (
						serialLog.map((line, i) => <div key={i}>{line}</div>)
					)}
					<div ref={serialEndRef} />
				</div>
			</div>
		</div>
	)
}

/* ── Helper: add floating text label above a component ───────────── */
function addLabel (scene: THREE.Scene, text: string, x: number, y: number, z: number) {
	const canvas = document.createElement('canvas')
	const ctx = canvas.getContext('2d')
	if (!ctx) return

	canvas.width = 256
	canvas.height = 64
	ctx.fillStyle = 'transparent'
	ctx.clearRect(0, 0, 256, 64)
	ctx.font = 'bold 28px monospace'
	ctx.fillStyle = '#ffffff'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.fillText(text, 128, 32)

	const texture = new THREE.CanvasTexture(canvas)
	texture.minFilter = THREE.LinearFilter
	const spriteMat = new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		depthTest: false,
	})
	const sprite = new THREE.Sprite(spriteMat)
	sprite.position.set(x, y, z)
	sprite.scale.set(12, 3, 1)
	sprite.userData.dynamic = true
	scene.add(sprite)
}
