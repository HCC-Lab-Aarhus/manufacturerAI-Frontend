'use client'

import { type ReactElement, useState } from 'react'

interface Props {
	view2D: ReactElement
	view3D: ReactElement
	default3D?: boolean
}

export default function ViewToggle ({ view2D, view3D, default3D }: Props): ReactElement {
	const [is3D, setIs3D] = useState(default3D ?? false)

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-1 border-b border-stone-200 px-3 py-1.5">
				<button
					onClick={() => setIs3D(false)}
					className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
						!is3D ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
					}`}
				>
					2D
				</button>
				<button
					onClick={() => setIs3D(true)}
					className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
						is3D ? 'bg-accent text-white' : 'text-stone-600 hover:bg-stone-100'
					}`}
				>
					3D
				</button>
			</div>
			<div className="flex-1 overflow-hidden">
				{is3D ? view3D : view2D}
			</div>
		</div>
	)
}
