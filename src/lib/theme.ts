export const DEFAULT_COLOR = '#2a2a2e'
const COOKIE_NAME = 'theme-color'

interface HSL { h: number; s: number; l: number }

function hexToHsl (hex: string): HSL {
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const lRaw = (max + min) / 2
	if (max === min) { return { h: 0, s: 0, l: lRaw * 100 } }
	const d = max - min
	const s = lRaw > 0.5 ? d / (2 - max - min) : d / (max + min)
	let h = 0
	if (max === r) { h = ((g - b) / d + (g < b ? 6 : 0)) / 6 }
	else if (max === g) { h = ((b - r) / d + 2) / 6 }
	else { h = ((r - g) / d + 4) / 6 }
	return { h: h * 360, s: s * 100, l: lRaw * 100 }
}

function clamp (v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v))
}

function hsl (h: number, s: number, l: number): string {
	return `hsl(${Math.round(h)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}%)`
}

export function isDarkTheme (hex: string): boolean {
	return hexToHsl(hex).l < 50
}

export function deriveThemeVars (hex: string): Record<string, string> {
	if (!/^#[\dA-Fa-f]{6}$/.test(hex)) { hex = DEFAULT_COLOR }
	const { h, s, l } = hexToHsl(hex)
	const isDark = l < 50
	const cd = isDark ? 1 : -1

	const accentS = clamp(s + 30, 30, 70)
	const accentL = isDark ? clamp(l + 30, 45, 65) : clamp(l - 30, 30, 48)

	const tintS = clamp(accentS * 0.45, 12, 40)
	const activeL = isDark ? clamp(l + 8, 10, 50) : clamp(l - 6, 60, 94)
	const chatUserL = isDark ? clamp(l + 10, 12, 45) : clamp(l - 10, 55, 88)

	return {
		'--color-surface': hsl(h, s, l),
		'--color-surface-alt': hsl(h, s, clamp(l - 3, 2, 98)),
		'--color-surface-card': hsl(h, s, clamp(l + 4, 3, 99)),
		'--color-surface-chip': hsl(h, s, clamp(l - 1.5, 2, 98)),
		'--color-surface-active': hsl(h, tintS, activeL),
		'--color-surface-hover': hsl(h, s, clamp(l + cd * 5, 2, 98)),
		'--color-border': hsl(h, clamp(s * 0.7, 0, 20), clamp(l + cd * 10, 5, 95)),
		'--color-border-light': hsl(h, clamp(s * 0.6, 0, 15), clamp(l + cd * 14, 5, 95)),
		'--color-fg': isDark
			? hsl(h, s * 0.2, 88)
			: hsl(h, clamp(s * 0.4, 0, 15), 22),
		'--color-fg-secondary': isDark
			? hsl(h, s * 0.15, 72)
			: hsl(h, clamp(s * 0.3, 0, 12), 38),
		'--color-fg-muted': isDark
			? hsl(h, s * 0.1, 55)
			: hsl(h, clamp(s * 0.2, 0, 10), 52),
		'--color-accent': hsl(h, accentS, accentL),
		'--color-accent-hover': hsl(h, accentS, clamp(accentL - 6, 15, 80)),
		'--color-accent-muted': hsl(h, clamp(accentS - 10, 15, 55), isDark ? clamp(accentL + 10, 45, 70) : clamp(accentL + 15, 45, 65)),
		'--color-accent-text': hsl(h, clamp(accentS - 5, 20, 55), isDark ? clamp(accentL + 15, 55, 80) : clamp(accentL - 5, 25, 45)),
		'--color-chat-user': hsl(h, clamp(accentS * 0.55, 15, 45), chatUserL),
		'--color-chat-ai': hsl(h, s, clamp(l - 1.5, 2, 98)),
		'--color-code-bg': isDark ? 'hsl(0 0% 100% / 0.08)' : 'hsl(0 0% 0% / 0.05)'
	}
}

export function applyTheme (hex: string): void {
	const vars = deriveThemeVars(hex)
	const el = document.documentElement
	for (const [key, value] of Object.entries(vars)) {
		el.style.setProperty(key, value)
	}
	el.style.setProperty('color-scheme', isDarkTheme(hex) ? 'dark' : 'light')
}

export function getStoredColor (): string {
	if (typeof document === 'undefined') { return DEFAULT_COLOR }
	const match = document.cookie.match(/(?:^|; )theme-color=([^;]*)/)
	return match ? decodeURIComponent(match[1]) : DEFAULT_COLOR
}

export function storeColor (hex: string): void {
	const encoded = encodeURIComponent(hex)
	document.cookie = `${COOKIE_NAME}=${encoded};path=/;max-age=31536000;SameSite=Lax`
}
