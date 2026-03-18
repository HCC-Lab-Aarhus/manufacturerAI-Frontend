export type SSEEventType =
	| 'session_created'
	| 'thinking_start'
	| 'thinking_delta'
	| 'message_start'
	| 'message_delta'
	| 'block_stop'
	| 'tool_call'
	| 'tool_result'
	| 'design'
	| 'circuit'
	| 'firmware'
	| 'sim_config'
	| 'invalidated'
	| 'token_usage'
	| 'session_named'
	| 'error'
	| 'done'

export interface SSEEvent {
	type: SSEEventType
	data: unknown
}

export interface ThinkingDeltaData {
	text: string
}

export interface MessageDeltaData {
	text: string
}

export interface ToolCallData {
	name: string
	input: Record<string, unknown>
}

export interface ToolResultData {
	name: string
	content: string
	is_error: boolean
}

export interface SessionCreatedData {
	session_id: string
}

export interface SessionNamedData {
	name: string
}

export interface TokenUsageData {
	input_tokens: number
	budget: number
}

export interface ErrorData {
	message: string
}
