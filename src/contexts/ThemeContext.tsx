'use client'

import { createContext, type ReactElement, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'

import { applyTheme, DEFAULT_COLOR, getStoredColor, storeColor } from '@/lib/theme'

interface ThemeContextValue {
	color: string
	setColor: (hex: string) => void
}

const ThemeContext = createContext<ThemeContextValue>({
	color: DEFAULT_COLOR,
	setColor: () => {}
})

export const useTheme = (): ThemeContextValue => useContext(ThemeContext)

interface Props {
	initialColor: string
	children: ReactNode
}

export function ThemeProvider ({ initialColor, children }: Props): ReactElement {
	const [color, setColorState] = useState(initialColor)

	useEffect(() => {
		const stored = getStoredColor()
		if (stored !== initialColor) {
			setColorState(stored)
			applyTheme(stored)
		}
	}, [initialColor])

	const setColor = useCallback((hex: string) => {
		setColorState(hex)
		storeColor(hex)
		applyTheme(hex)
	}, [])

	return (
		<ThemeContext.Provider value={{ color, setColor }}>
			{children}
		</ThemeContext.Provider>
	)
}
