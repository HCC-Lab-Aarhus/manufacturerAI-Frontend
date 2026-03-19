import type { SSEEventType } from '@/types/events'

export interface SSECallbacks {
	onEvent: (type: SSEEventType, data: unknown) => void
	onError?: (error: Error) => void
	onDone?: () => void
}

export function consumeSSEStream (
	url: string,
	options: RequestInit,
	callbacks: SSECallbacks
): AbortController {
	const controller = new AbortController()

	const run = async () => {
		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			})

			if (!response.ok) {
				const text = await response.text()
				throw new Error(`SSE request failed (${response.status}): ${text}`)
			}

			const reader = response.body?.getReader()
			if (!reader) {
				throw new Error('No response body')
			}

			const decoder = new TextDecoder()
			const MAX_BUFFER = 10 * 1024 * 1024 // 10 MB
			let buffer = ''
			let currentEventType: SSEEventType | null = null

			while (true) {
				const { done, value } = await reader.read()
				if (done) { break }

				buffer += decoder.decode(value, { stream: true })
				if (buffer.length > MAX_BUFFER) {
					throw new Error('SSE buffer exceeded 10 MB')
				}
				const lines = buffer.split('\n')
				buffer = lines.pop() ?? ''

				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEventType = line.slice(7).trim() as SSEEventType
					} else if (line.startsWith('data: ') && currentEventType) {
						try {
							const data = JSON.parse(line.slice(6))
							callbacks.onEvent(currentEventType, data)
						} catch {
							callbacks.onEvent(currentEventType, line.slice(6))
						}
						currentEventType = null
					} else if (line.trim() === '') {
						currentEventType = null
					}
				}
			}

			callbacks.onDone?.()
		} catch (err) {
			if ((err as Error).name === 'AbortError') { return }
			callbacks.onError?.(err as Error)
		}
	}

	run()
	return controller
}
