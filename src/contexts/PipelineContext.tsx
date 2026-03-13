'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react'

import type {
	DesignSpec,
	CircuitSpec,
	PlacementResult,
	RoutingResult,
	CompileStatus,
	GCodeStatus
} from '@/types/models'

interface PipelineData {
	design: DesignSpec | null
	circuit: CircuitSpec | null
	placement: PlacementResult | null
	routing: RoutingResult | null
	compileStatus: CompileStatus | null
	gcodeStatus: GCodeStatus | null
}

interface PipelineContextValue extends PipelineData {
	setDesign: (d: DesignSpec | null) => void
	setCircuit: (c: CircuitSpec | null) => void
	setPlacement: (p: PlacementResult | null) => void
	setRouting: (r: RoutingResult | null) => void
	setCompileStatus: (s: CompileStatus | null) => void
	setGcodeStatus: (s: GCodeStatus | null) => void
	clearAll: () => void
}

const PipelineContext = createContext<PipelineContextValue>({
	design: null,
	circuit: null,
	placement: null,
	routing: null,
	compileStatus: null,
	gcodeStatus: null,
	setDesign: () => {},
	setCircuit: () => {},
	setPlacement: () => {},
	setRouting: () => {},
	setCompileStatus: () => {},
	setGcodeStatus: () => {},
	clearAll: () => {}
})

export function usePipeline (): PipelineContextValue {
	return useContext(PipelineContext)
}

export function PipelineProvider ({ children }: { children: ReactNode }) {
	const [design, setDesign] = useState<DesignSpec | null>(null)
	const [circuit, setCircuit] = useState<CircuitSpec | null>(null)
	const [placement, setPlacement] = useState<PlacementResult | null>(null)
	const [routing, setRouting] = useState<RoutingResult | null>(null)
	const [compileStatus, setCompileStatus] = useState<CompileStatus | null>(null)
	const [gcodeStatus, setGcodeStatus] = useState<GCodeStatus | null>(null)

	const clearAll = useCallback(() => {
		setDesign(null)
		setCircuit(null)
		setPlacement(null)
		setRouting(null)
		setCompileStatus(null)
		setGcodeStatus(null)
	}, [])

	const value = useMemo(() => ({
		design,
		circuit,
		placement,
		routing,
		compileStatus,
		gcodeStatus,
		setDesign,
		setCircuit,
		setPlacement,
		setRouting,
		setCompileStatus,
		setGcodeStatus,
		clearAll
	}), [design, circuit, placement, routing, compileStatus, gcodeStatus, clearAll])

	return (
		<PipelineContext.Provider value={value}>
			{children}
		</PipelineContext.Provider>
	)
}
