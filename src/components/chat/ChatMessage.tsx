'use client'

import { type ReactElement, useState } from 'react'

import type { ChatEntry } from '@/hooks/useDesignAgent'

interface ChatMessageProps {
	entry: ChatEntry
}

export default function ChatMessage ({ entry }: ChatMessageProps): ReactElement {
	const [expanded, setExpanded] = useState(false)

	if (entry.role === 'thinking') {
		return (
			<div className="group">
				<button
					onClick={() => { setExpanded(!expanded) }}
					className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
				>
					<span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>{'▶'}</span>
					<span>{'Thinking'}{entry.isStreaming ? '…' : ''}</span>
				</button>
				{expanded && (
					<pre className="mt-1 max-h-60 overflow-auto rounded border border-neutral-700 bg-neutral-900 p-2 text-xs text-neutral-400 whitespace-pre-wrap">
						{entry.content}
					</pre>
				)}
			</div>
		)
	}

	if (entry.role === 'tool_call') {
		return (
			<div className="rounded border border-neutral-700 bg-neutral-900/50 p-2">
				<div className="flex items-center gap-1.5 text-xs text-amber-400">
					<span>{'🔧'}</span>
					<span className="font-medium">{entry.toolName}</span>
				</div>
				<button
					onClick={() => { setExpanded(!expanded) }}
					className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
				>
					{expanded ? 'Hide input' : 'Show input'}
				</button>
				{expanded && (
					<pre className="mt-1 max-h-40 overflow-auto text-xs text-neutral-500 whitespace-pre-wrap">
						{entry.content}
					</pre>
				)}
			</div>
		)
	}

	if (entry.role === 'tool_result') {
		return (
			<div className={`rounded border p-2 ${entry.isError ? 'border-red-700 bg-red-950/30' : 'border-neutral-700 bg-neutral-900/50'}`}>
				<div className={`flex items-center gap-1.5 text-xs ${entry.isError ? 'text-red-400' : 'text-green-400'}`}>
					<span>{entry.isError ? '✗' : '✓'}</span>
					<span className="font-medium">{entry.toolName}{' result'}</span>
				</div>
				<button
					onClick={() => { setExpanded(!expanded) }}
					className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
				>
					{expanded ? 'Hide output' : 'Show output'}
				</button>
				{expanded && (
					<pre className="mt-1 max-h-40 overflow-auto text-xs text-neutral-500 whitespace-pre-wrap">
						{entry.content}
					</pre>
				)}
			</div>
		)
	}

	const isUser = entry.role === 'user'

	return (
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
			<div
				className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
					isUser
						? 'bg-blue-600 text-white'
						: 'bg-neutral-800 text-neutral-200'
				}`}
			>
				{entry.content}
				{entry.isStreaming && (
					<span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current" />
				)}
			</div>
		</div>
	)
}
