'use client'

import { type ReactElement, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { ChatEntry } from '@/hooks/useDesignAgent'

interface ChatMessageProps {
	entry: ChatEntry
}

function ToolCallGroup ({ entries }: { entries: ChatEntry[] }): ReactElement {
	const [expanded, setExpanded] = useState(false)
	const count = entries.filter(e => e.role === 'tool_call').length
	const hasError = entries.some(e => e.isError)

	return (
		<div className="my-0.5">
			<button
				onClick={() => { setExpanded(!expanded) }}
				className="flex items-center gap-2 rounded-md px-2.5 py-1 text-xs text-stone-600 hover:text-stone-700 transition-colors"
			>
				<span className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>{'▶'}</span>
				<span className="font-medium">
					{count} tool {count === 1 ? 'call' : 'calls'}
				</span>
				{hasError && <span className="text-rose-600">{'(error)'}</span>}
			</button>
			{expanded && (
				<div className="ml-4 mt-1 flex flex-col gap-0.5 border-l-2 border-stone-200 pl-3">
					{entries.map(e => {
						const isResult = e.role === 'tool_result'
						const icon = isResult ? (e.isError ? '✗' : '✓') : '→'
						const color = isResult
						? (e.isError ? 'text-rose-600' : 'text-emerald-600')
						: 'text-stone-600'
						const brief = e.content.length > 120
							? e.content.slice(0, 120) + '…'
							: e.content
						return (
							<div key={e.id} className="text-[11px] leading-relaxed text-stone-600">
								<span className={color}>{icon}</span>{' '}
								<span className="font-medium text-stone-600">{e.toolName}</span>{' '}
								<span className="text-stone-500">{brief}</span>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

export { ToolCallGroup }

export default function ChatMessage ({ entry }: ChatMessageProps): ReactElement {
	const [expanded, setExpanded] = useState(false)

	if (entry.role === 'thinking') {
		return (
			<div>
				<button
					onClick={() => { setExpanded(!expanded) }}
					className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-700 transition-colors"
				>
					<span className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>{'▶'}</span>
					<span>{'Thinking'}{entry.isStreaming ? '…' : ''}</span>
				</button>
				{expanded && (
					<pre className="mt-1 overflow-auto text-xs text-stone-600 whitespace-pre-wrap leading-relaxed">
						{entry.content}
					</pre>
				)}
			</div>
		)
	}

	if (entry.role === 'tool_call' || entry.role === 'tool_result') {
		return <></>
	}

	const isUser = entry.role === 'user'

	return (
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
			<div
				className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
					isUser
						? 'bg-[#b8c5e2] text-stone-800'
						: 'bg-[#efeee9] text-stone-700'
				}`}
			>
				<div className="markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
					<Markdown remarkPlugins={[remarkGfm]}>{entry.content}</Markdown>
				</div>
				{entry.isStreaming && (
					<span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-stone-400 rounded-sm" />
				)}
			</div>
		</div>
	)
}
