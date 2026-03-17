interface SpeechRecognitionEvent extends Event {
	readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
	readonly length: number
	[index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
	readonly length: number
	readonly isFinal: boolean
	[index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
	readonly transcript: string
	readonly confidence: number
}

interface SpeechRecognition extends EventTarget {
	lang: string
	continuous: boolean
	interimResults: boolean
	onresult: ((event: SpeechRecognitionEvent) => void) | null
	onerror: ((event: Event) => void) | null
	onend: (() => void) | null
	start(): void
	stop(): void
	abort(): void
}

declare var SpeechRecognition: {
	new(): SpeechRecognition
	prototype: SpeechRecognition
}

interface Window {
	SpeechRecognition?: typeof SpeechRecognition
	webkitSpeechRecognition?: typeof SpeechRecognition
}
