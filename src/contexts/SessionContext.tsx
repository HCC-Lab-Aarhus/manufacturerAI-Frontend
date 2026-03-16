'use client'

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState
} from 'react'

import { deleteSession as apiDeleteSession, getSession, listSessions, renameSession as apiRenameSession } from '@/lib/api'
import type { PipelineError, PipelineStage, Printer, SessionMeta } from '@/types/models'

const PRINTER_COOKIE = 'printer-id'

export function getStoredPrinterId (): string {
	if (typeof document === 'undefined') { return '' }
	const match = document.cookie.match(/(?:^|; )printer-id=([^;]*)/)
	return match ? decodeURIComponent(match[1]) : ''
}

function storePrinterId (id: string): void {
	if (!id) {
		document.cookie = `${PRINTER_COOKIE}=;path=/;max-age=0;SameSite=Lax`
		return
	}
	document.cookie = `${PRINTER_COOKIE}=${encodeURIComponent(id)};path=/;max-age=31536000;SameSite=Lax`
}

interface SessionContextValue {
	sessions: SessionMeta[]
	currentSession: SessionMeta | null
	activeStage: PipelineStage
	loading: boolean
	pendingInvalidation: string[] | null
	setActiveStage: (stage: PipelineStage) => void
	selectSession: (id: string) => Promise<void>
	clearSession: () => void
	refreshSession: () => Promise<void>
	refreshSessions: () => Promise<void>
	patchSession: (data: { artifacts?: Record<string, boolean>; pipeline_errors?: Record<string, PipelineError>; invalidated_steps?: string[] }) => void
	clearInvalidation: () => void
	renameSession: (id: string, name: string) => Promise<void>
	deleteSession: (id: string) => Promise<void>
	printer: Printer | null
	setPrinter: (p: Printer | null) => void
}

const SessionContext = createContext<SessionContextValue>({
	sessions: [],
	currentSession: null,
	activeStage: 'design',
	loading: false,
	pendingInvalidation: null,
	setActiveStage: () => {},
	selectSession: async () => {},
	clearSession: () => {},
	refreshSession: async () => {},
	refreshSessions: async () => {},
	patchSession: () => {},
	clearInvalidation: () => {},
	renameSession: async () => {},
	deleteSession: async () => {},
	printer: null,
	setPrinter: () => {}
})

export function useSession (): SessionContextValue {
	return useContext(SessionContext)
}

const STAGE_ORDER: PipelineStage[] = ['design', 'circuit', 'manufacture']
const VALID_STAGES = new Set<string>(STAGE_ORDER)

function syncTabParam (stage: PipelineStage): void {
	const url = new URL(window.location.href)
	if (stage === 'design') {
		url.searchParams.delete('tab')
	} else {
		url.searchParams.set('tab', stage)
	}
	window.history.replaceState(null, '', url.toString())
}

export function isStageAccessible (
	stage: PipelineStage,
	pipelineState: SessionMeta['pipeline_state']
): boolean {
	if (stage === 'design') { return true }
	if (stage === 'circuit') {
		const s = pipelineState.design
		return s === 'complete' || s === 'done'
	}
	if (stage === 'manufacture') {
		const s = pipelineState.circuit
		return s === 'complete' || s === 'done'
	}
	return true
}

export function SessionProvider ({ children }: { children: ReactNode }) {
	const [sessions, setSessions] = useState<SessionMeta[]>([])
	const [currentSession, setCurrentSession] = useState<SessionMeta | null>(null)
	const [activeStage, _setActiveStage] = useState<PipelineStage>('design')

	useLayoutEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const tab = params.get('tab')
		if (tab && VALID_STAGES.has(tab)) {
			_setActiveStage(tab as PipelineStage)
		}
		if (params.get('session')) {
			setLoading(true)
		}
	}, [])

	const setActiveStage = useCallback((stage: PipelineStage) => {
		_setActiveStage(stage)
		syncTabParam(stage)
	}, [])
	const [loading, setLoading] = useState(false)
	const [printer, _setPrinter] = useState<Printer | null>(null)
	const [pendingInvalidation, setPendingInvalidation] = useState<string[] | null>(null)

	const setPrinter = useCallback((p: Printer | null) => {
		_setPrinter(p)
		storePrinterId(p?.id ?? '')
	}, [])

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
			const url = new URL(window.location.href)
			url.searchParams.set('session', id)
			window.history.replaceState(null, '', url.toString())
		} finally {
			setLoading(false)
		}
	}, [])

	const clearSession = useCallback(() => {
		setCurrentSession(null)
		_setActiveStage('design')
		setPendingInvalidation(null)
		const url = new URL(window.location.href)
		url.searchParams.delete('session')
		url.searchParams.delete('tab')
		window.history.replaceState(null, '', url.toString())
	}, [])

	const patchSession = useCallback((data: { artifacts?: Record<string, boolean>; pipeline_errors?: Record<string, PipelineError>; invalidated_steps?: string[] }) => {
		const { invalidated_steps, ...sessionPatch } = data
		if (Object.keys(sessionPatch).length > 0) {
			setCurrentSession(prev => prev ? { ...prev, ...sessionPatch } : prev)
		}
		if (invalidated_steps?.length) {
			setPendingInvalidation(invalidated_steps)
		}
	}, [])

	const clearInvalidation = useCallback(() => {
		setPendingInvalidation(null)
	}, [])

	const renameSession = useCallback(async (id: string, name: string) => {
		await apiRenameSession(id, name)
		setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
		setCurrentSession(prev => prev?.id === id ? { ...prev, name } : prev)
	}, [])

	const deleteSessionCb = useCallback(async (id: string) => {
		await apiDeleteSession(id)
		setSessions(prev => prev.filter(s => s.id !== id))
		setCurrentSession(prev => {
			if (prev?.id === id) return null
			return prev
		})
		const url = new URL(window.location.href)
		if (url.searchParams.has('session')) {
			url.searchParams.delete('session')
			url.searchParams.delete('tab')
			window.history.replaceState(null, '', url.toString())
		}
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
		pendingInvalidation,
		setActiveStage,
		selectSession,
		clearSession,
		refreshSession,
		refreshSessions,
		patchSession,
		clearInvalidation,
		renameSession,
		deleteSession: deleteSessionCb,
		printer,
		setPrinter
	}), [sessions, currentSession, activeStage, loading, pendingInvalidation, selectSession, clearSession, refreshSession, refreshSessions, patchSession, clearInvalidation, renameSession, deleteSessionCb, printer])

	return (
		<SessionContext.Provider value={value}>
			{children}
		</SessionContext.Provider>
	)
}
