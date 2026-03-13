'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState
} from 'react'

import { getSession, listSessions } from '@/lib/api'
import type { PipelineStage, Printer, SessionMeta } from '@/types/models'

interface SessionContextValue {
	sessions: SessionMeta[]
	currentSession: SessionMeta | null
	activeStage: PipelineStage
	loading: boolean
	setActiveStage: (stage: PipelineStage) => void
	selectSession: (id: string) => Promise<void>
	clearSession: () => void
	refreshSession: () => Promise<void>
	refreshSessions: () => Promise<void>
	printer: Printer | null
	setPrinter: (p: Printer | null) => void
}

const SessionContext = createContext<SessionContextValue>({
	sessions: [],
	currentSession: null,
	activeStage: 'design',
	loading: false,
	setActiveStage: () => {},
	selectSession: async () => {},
	clearSession: () => {},
	refreshSession: async () => {},
	refreshSessions: async () => {},
	printer: null,
	setPrinter: () => {}
})

export function useSession (): SessionContextValue {
	return useContext(SessionContext)
}

const STAGE_ORDER: PipelineStage[] = ['design', 'circuit', 'placement', 'routing', 'scad', 'gcode']

export function isStageAccessible (
	stage: PipelineStage,
	pipelineState: SessionMeta['pipeline_state']
): boolean {
	if (stage === 'design') { return true }
	const idx = STAGE_ORDER.indexOf(stage)
	const prev = STAGE_ORDER[idx - 1]
	return pipelineState[prev] === 'complete'
}

export function SessionProvider ({ children }: { children: ReactNode }) {
	const [sessions, setSessions] = useState<SessionMeta[]>([])
	const [currentSession, setCurrentSession] = useState<SessionMeta | null>(null)
	const [activeStage, setActiveStage] = useState<PipelineStage>('design')
	const [loading, setLoading] = useState(false)
	const [printer, setPrinter] = useState<Printer | null>(null)

	const refreshSessions = useCallback(async () => {
		const list = await listSessions()
		setSessions(list)
	}, [])

	const refreshSession = useCallback(async () => {
		if (!currentSession) { return }
		const updated = await getSession(currentSession.id)
		setCurrentSession(updated)
	}, [currentSession])

	const selectSession = useCallback(async (id: string) => {
		setLoading(true)
		try {
			const session = await getSession(id)
			setCurrentSession(session)
			setActiveStage('design')
			const url = new URL(window.location.href)
			url.searchParams.set('session', id)
			window.history.replaceState(null, '', url.toString())
		} finally {
			setLoading(false)
		}
	}, [])

	const clearSession = useCallback(() => {
		setCurrentSession(null)
		setActiveStage('design')
		const url = new URL(window.location.href)
		url.searchParams.delete('session')
		window.history.replaceState(null, '', url.toString())
	}, [])

	useEffect(() => {
		const init = async () => {
			await refreshSessions()
			const params = new URLSearchParams(window.location.search)
			const sessionParam = params.get('session')
			if (sessionParam) {
				await selectSession(sessionParam)
			}
		}
		init()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const value = useMemo(() => ({
		sessions,
		currentSession,
		activeStage,
		loading,
		setActiveStage,
		selectSession,
		clearSession,
		refreshSession,
		refreshSessions,
		printer,
		setPrinter
	}), [sessions, currentSession, activeStage, loading, selectSession, clearSession, refreshSession, refreshSessions, printer])

	return (
		<SessionContext.Provider value={value}>
			{children}
		</SessionContext.Provider>
	)
}
