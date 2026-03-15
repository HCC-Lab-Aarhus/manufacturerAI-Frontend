const sid = (id: string) => encodeURIComponent(id)

export function getBundleDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/bundle`
}

export function getPrintJobDownloadUrl (sessionId: string): string {
	const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
	return `${base}/api/v2/sessions/${sid(sessionId)}/manufacture/print-job`
}
