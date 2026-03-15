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

export interface PipelineFeedback {
	target: 'design' | 'circuit'
	message: string
}

interface PipelineContextValue {
	design: DesignSpec | null
	circuit: CircuitSpec | null
	setDesign: (d: DesignSpec | null) => void
	setCircuit: (c: CircuitSpec | null) => void
	clearAll: () => void
	pendingFeedback: PipelineFeedback | null
	setPendingFeedback: (f: PipelineFeedback | null) => void
}

const PipelineContext = createContext<PipelineContextValue>({
	design: null,
	circuit: null,
	setDesign: () => {},
	setCircuit: () => {},
	clearAll: () => {},
	pendingFeedback: null,
	setPendingFeedback: () => {}
})

export function usePipeline (): PipelineContextValue {
	return useContext(PipelineContext)
}

export function PipelineProvider ({ children }: { children: ReactNode }) {
	const [design, setDesign] = useState<DesignSpec | null>(null)
	const [circuit, setCircuit] = useState<CircuitSpec | null>(null)
	const [pendingFeedback, setPendingFeedback] = useState<PipelineFeedback | null>(null)

	const clearAll = useCallback(() => {
		setDesign(null)
		setCircuit(null)
	}, [])

	const value = useMemo(() => ({
		design,
		circuit,
		setDesign,
		setCircuit,
		clearAll,
		pendingFeedback,
		setPendingFeedback
	}), [design, circuit, clearAll, pendingFeedback])

	return (
		<PipelineContext.Provider value={value}>
			{children}
		</PipelineContext.Provider>
	)
}
