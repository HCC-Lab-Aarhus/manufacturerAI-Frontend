'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react'

import type { DesignSpec, CircuitSpec } from '@/types/models'

interface PipelineContextValue {
	design: DesignSpec | null
	circuit: CircuitSpec | null
	setDesign: (d: DesignSpec | null) => void
	setCircuit: (c: CircuitSpec | null) => void
	clearAll: () => void
}

const PipelineContext = createContext<PipelineContextValue>({
	design: null,
	circuit: null,
	setDesign: () => {},
	setCircuit: () => {},
	clearAll: () => {}
})

export function usePipeline (): PipelineContextValue {
	return useContext(PipelineContext)
}

export function PipelineProvider ({ children }: { children: ReactNode }) {
	const [design, setDesign] = useState<DesignSpec | null>(null)
	const [circuit, setCircuit] = useState<CircuitSpec | null>(null)

	const clearAll = useCallback(() => {
		setDesign(null)
		setCircuit(null)
	}, [])

	const value = useMemo(() => ({
		design,
		circuit,
		setDesign,
		setCircuit,
		clearAll
	}), [design, circuit, clearAll])

	return (
		<PipelineContext.Provider value={value}>
			{children}
		</PipelineContext.Provider>
	)
}
