'use client'

import { type ReactElement, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { ChatEntry } from '@/hooks/useDesignAgent'

interface ChatMessageProps {
	entry: ChatEntry
}

function ToolCallPair ({ call, result }: { call: ChatEntry; result?: ChatEntry }): ReactElement {
	const [open, setOpen] = useState(false)
	const brief = call.content.length > 100 ? call.content.slice(0, 100) + '…' : call.content

	return (
		<div>
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg-secondary transition-colors"
			>
				<span className={`text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>{'▶'}</span>
				<span className="font-medium">{call.toolName}</span>
				{result && (
					<span className={result.isError ? 'text-danger' : 'text-success'}>
						{result.isError ? '✗' : '✓'}
					</span>
				)}
			</button>
			{open && (
				<div className="ml-4 mt-0.5 space-y-1">
					<pre className="overflow-auto rounded bg-surface-card px-2 py-1 text-[10px] leading-relaxed text-fg-muted whitespace-pre-wrap">
						{call.content}
					</pre>
					{result && (
						<div className={`ml-2 rounded px-2 py-1 text-[10px] leading-relaxed whitespace-pre-wrap ${
							result.isError ? 'bg-danger/10 text-danger' : 'bg-surface-card text-fg-secondary'
						}`}>
							{result.content}
						</div>
					)}
				</div>
			)}
			{!open && !result && (
				<div className="ml-5 text-[10px] text-fg-muted truncate max-w-md">{brief}</div>
			)}
		</div>
	)
}

function ToolCallGroup ({ entries }: { entries: ChatEntry[] }): ReactElement {
	const pairs = useMemo(() => {
		const result: { call: ChatEntry; result?: ChatEntry }[] = []
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].role === 'tool_call') {
				const next = entries[i + 1]
				if (next?.role === 'tool_result') {
					result.push({ call: entries[i], result: next })
					i++
				} else {
					result.push({ call: entries[i] })
				}
			}
		}
		return result
	}, [entries])

	const [expanded, setExpanded] = useState(false)
	const count = pairs.length
	const hasError = entries.some(e => e.isError)

	return (
		<div className="my-0.5">
			<button
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg-secondary transition-colors"
			>
				<span className={`text-[9px] transition-transform ${expanded ? 'rotate-90' : ''}`}>{'▶'}</span>
				<span>{count} tool {count === 1 ? 'call' : 'calls'}</span>
				{hasError && <span className="text-danger">{'(error)'}</span>}
			</button>
			{expanded && (
				<div className="ml-3 mt-1 flex flex-col gap-1.5 border-l border-border/50 pl-3">
					{pairs.map(p => (
						<ToolCallPair key={p.call.id} call={p.call} result={p.result} />
					))}
				</div>
			)}
		</div>
	)
}

export { ToolCallGroup }

function ThinkingPreview ({ content }: { content: string }): ReactElement {
	return (
		<div
			className="mt-0.5 overflow-hidden"
			style={{
				maxHeight: '4.5lh',
				maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
				WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
			}}
		>
			<div className="flex flex-col-reverse">
				<div className="text-[11px] leading-snug text-fg-muted/70 break-words">
					{content}
				</div>
			</div>
		</div>
	)
}

export default function ChatMessage ({ entry }: ChatMessageProps): ReactElement {
	const [expanded, setExpanded] = useState(false)

	if (entry.role === 'status') {
		return (
			<div className="flex justify-center py-1">
				<span className="text-[11px] text-fg-muted">{'✓ '}{entry.content}</span>
			</div>
		)
	}

	if (entry.role === 'thinking') {
		return (
			<div>
				{expanded ? (
					<div className="text-xs text-fg-secondary leading-relaxed markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
						<Markdown remarkPlugins={[remarkGfm]}>{entry.content}</Markdown>
					</div>
				) : entry.content.length > 0 && (
					<ThinkingPreview content={entry.content} />
				)}
				{entry.content.length > 0 && !entry.isStreaming && (
					<button
						onClick={() => setExpanded(!expanded)}
						className="text-[11px] text-fg-muted hover:text-fg-secondary transition-colors mt-0.5"
					>
						{expanded ? 'Collapse' : 'Expand'}
					</button>
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
						? 'bg-chat-user text-fg'
						: 'bg-chat-ai text-fg'
				}`}
			>
				<div className="markdown-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
					<Markdown remarkPlugins={[remarkGfm]}>{entry.content}</Markdown>
				</div>
				{entry.isStreaming && (
					<span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-fg-muted rounded-sm" />
				)}
			</div>
		</div>
	)
}
