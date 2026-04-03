export const DEFAULT_COLOR = '#2a2a2e'
const COOKIE_NAME = 'theme-color'

interface HSL { h: number; s: number; l: number }
interface RGB { r: number; g: number; b: number }

// ── Conversion ──────────────────────────────────────────────

export function hexToRgb (hex: string): RGB {
	return {
		r: parseInt(hex.slice(1, 3), 16),
		g: parseInt(hex.slice(3, 5), 16),
		b: parseInt(hex.slice(5, 7), 16),
	}
}

function hexToHsl (hex: string): HSL {
	const { r: rRaw, g: gRaw, b: bRaw } = hexToRgb(hex)
	const r = rRaw / 255, g = gRaw / 255, b = bRaw / 255
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

function hslA (h: number, s: number, l: number, a: number): string {
	return `hsl(${Math.round(h)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}% / ${a})`
}

// ── Contrast (WCAG 2.1) ────────────────────────────────────

export function relativeLuminance (hex: string): number {
	const { r, g, b } = hexToRgb(hex)
	const [rs, gs, bs] = [r, g, b].map(c => {
		const s = c / 255
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
	})
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function contrastRatio (a: string, b: string): number {
	const la = relativeLuminance(a)
	const lb = relativeLuminance(b)
	const lighter = Math.max(la, lb)
	const darker = Math.min(la, lb)
	return (lighter + 0.05) / (darker + 0.05)
}

export function meetsAA (ratio: number, largeText = false): boolean {
	return largeText ? ratio >= 3 : ratio >= 4.5
}

export function meetsAAA (ratio: number, largeText = false): boolean {
	return largeText ? ratio >= 4.5 : ratio >= 7
}

export function contrastText (bgHex: string, light = '#e0e0e0', dark = '#222222'): string {
	return relativeLuminance(bgHex) > 0.179 ? dark : light
}

// ── Alpha helper ────────────────────────────────────────────

export function withAlpha (hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex)
	return `rgba(${r},${g},${b},${alpha})`
}

// ── Theme detection ─────────────────────────────────────────

export function isDarkTheme (hex: string): boolean {
	return hexToHsl(hex).l < 50
}

// ── Contrast text for HSL backgrounds ───────────────────────

function onColor (bgL: number, isDark: boolean, h: number, s: number): string {
	if (bgL > 65) return hsl(h, clamp(s * 0.4, 0, 15), 15)
	if (bgL < 35) return hsl(h, clamp(s * 0.15, 0, 10), 92)
	return bgL > 50 ? hsl(h, clamp(s * 0.3, 0, 12), 12) : hsl(h, clamp(s * 0.1, 0, 8), 95)
}

// ── CSS variable derivation ─────────────────────────────────

export function deriveThemeVars (hex: string): Record<string, string> {
	if (!/^#[\dA-Fa-f]{6}$/.test(hex)) { hex = DEFAULT_COLOR }
	const { h, s, l } = hexToHsl(hex)
	const isDark = l < 50
	const cd = isDark ? 1 : -1

	const satScale = Math.min(s / 20, 1)
	const accentS = clamp(s + satScale * 30, 0, 70)
	const accentL = isDark ? clamp(l + 30, 45, 65) : clamp(l - 30, 30, 48)

	const tintS = clamp(accentS * 0.45, 0, 40)
	const activeL = isDark ? clamp(l + 8, 10, 50) : clamp(l - 6, 60, 94)
	const chatUserL = isDark ? clamp(l + 10, 12, 45) : clamp(l - 10, 55, 88)

	const statusS = clamp(s + satScale * 20, 0, 65)
	const statusL = isDark ? clamp(l + 25, 40, 55) : clamp(l - 5, 35, 50)
	const statusHoverL = clamp(statusL - 5, 25, 50)

	const mutedStrokeL = isDark ? clamp(l + 20, 40, 70) : clamp(l - 15, 30, 55)
	const mutedStrokeS = clamp(s * 0.5, 0, 20)

	return {
		'--color-surface': hsl(h, s, l),
		'--color-surface-alt': hsl(h, s, clamp(l - 3, 2, 98)),
		'--color-surface-card': hsl(h, s, clamp(l + 4, 3, 99)),
		'--color-surface-chip': hsl(h, s, clamp(l - 1.5, 2, 98)),
		'--color-surface-active': hsl(h, tintS, activeL),
		'--color-surface-hover': hsl(h, s, clamp(l + cd * 5, 2, 98)),

		'--color-border': hsl(h, clamp(s * 0.7, 0, 20), clamp(l + cd * 10, 5, 95)),
		'--color-border-light': hsl(h, clamp(s * 0.6, 0, 15), clamp(l + cd * 14, 5, 95)),
		'--color-divider': hsl(h, clamp(accentS * 0.3, 0, 25), isDark ? clamp(l + 12, 18, 55) : clamp(l - 10, 50, 80)),

		'--color-fg': isDark
			? hsl(h, s * 0.2, 88)
			: hsl(h, clamp(s * 0.4, 0, 15), 18),
		'--color-fg-secondary': isDark
			? hsl(h, s * 0.15, 72)
			: hsl(h, clamp(s * 0.3, 0, 12), 32),
		'--color-fg-muted': isDark
			? hsl(h, s * 0.1, 55)
			: hsl(h, clamp(s * 0.2, 0, 10), 44),

		'--color-accent': hsl(h, accentS, accentL),
		'--color-accent-hover': hsl(h, accentS, clamp(accentL - 6, 15, 80)),
		'--color-accent-muted': hsl(h, clamp(accentS - 10, 0, 55), isDark ? clamp(accentL + 10, 45, 70) : clamp(accentL + 15, 45, 65)),
		'--color-accent-text': hsl(h, clamp(accentS - 5, 0, 55), isDark ? clamp(accentL + 15, 55, 80) : clamp(accentL - 5, 25, 45)),

		'--color-chat-user': hsl(h, clamp(accentS * 0.55, 0, 45), chatUserL),
		'--color-chat-ai': hsl(h, s, clamp(l - 1.5, 2, 98)),

		'--color-code-bg': isDark ? 'hsl(0 0% 100% / 0.08)' : 'hsl(0 0% 0% / 0.05)',

		'--color-success': hsl(140, statusS, statusL),
		'--color-success-hover': hsl(140, statusS, statusHoverL),
		'--color-warning': hsl(45, clamp(statusS + 10, 50, 75), isDark ? clamp(statusL + 10, 50, 70) : clamp(statusL + 5, 45, 55)),
		'--color-danger': hsl(0, statusS, statusL),
		'--color-danger-hover': hsl(0, statusS, statusHoverL),

		'--color-pin-input': hsl(h, accentS, accentL),
		'--color-pin-output': hsl(0, statusS, statusL),
		'--color-pin-bidir': hsl(45, clamp(statusS + 10, 50, 75), isDark ? clamp(statusL + 10, 50, 70) : clamp(statusL + 5, 45, 55)),

		'--color-drag-valid': hsl(160, 55, isDark ? 60 : 45),
		'--color-drag-valid-fill': hslA(160, 55, isDark ? 60 : 45, 0.25),
		'--color-drag-invalid': hsl(0, 65, isDark ? 55 : 50),
		'--color-drag-invalid-fill': hslA(0, 65, isDark ? 55 : 50, 0.25),
		'--color-drag-pending': hsl(45, 75, isDark ? 60 : 50),
		'--color-drag-pending-fill': hslA(45, 75, isDark ? 60 : 50, 0.2),

		'--color-body-fill': hslA(h, s, l, isDark ? 0.12 : 0.08),
		'--color-body-stroke': hsl(h, mutedStrokeS, mutedStrokeL),
		'--color-body-fill-hl': hslA(h, accentS, accentL, 0.15),
		'--color-body-stroke-hl': hsl(h, accentS, accentL),
		'--color-label': hsl(h, mutedStrokeS, mutedStrokeL),

		'--color-outline-fill': hslA(h, accentS, accentL, 0.06),
		'--color-outline-stroke': hsl(h, accentS, accentL),
		'--color-grid': isDark ? 'hsl(0 0% 100% / 0.04)' : 'hsl(0 0% 0% / 0.04)',
		'--color-pcb-fill': hslA(140, 50, isDark ? 40 : 35, 0.06),
		'--color-pcb-stroke': hsl(140, 50, isDark ? 50 : 38),

		'--color-guide-active': hslA(210, 70, 60, 0.25),
		'--color-guide-default': hslA(210, 10, 50, 0.15),

		'--color-on-accent': onColor(accentL, isDark, h, s),
		'--color-on-accent-muted': onColor(isDark ? clamp(accentL + 10, 45, 70) : clamp(accentL + 15, 45, 65), isDark, h, s),
		'--color-on-danger': onColor(statusL, isDark, 0, 0),
		'--color-on-success': onColor(statusL, isDark, 140, 0),
		'--color-on-warning': onColor(isDark ? clamp(statusL + 10, 50, 70) : clamp(statusL + 5, 45, 55), isDark, 45, 0),

		'--color-error-bg': isDark
			? hslA(0, clamp(s + 15, 30, 50), clamp(l + 5, 15, 25), 0.95)
			: hslA(0, 70, 95, 0.95),
		'--color-error-border': isDark
			? hsl(0, clamp(s + 10, 25, 45), clamp(l + 15, 30, 45))
			: hsl(0, 50, 85),
		'--color-error-fg': isDark
			? hsl(0, 55, 80)
			: hsl(0, 55, 35),
		'--color-error-fg-muted': isDark
			? hsl(0, 40, 65)
			: hsl(0, 45, 55),

		'--color-info-bg': isDark
			? hslA(h, clamp(s + 5, 15, 35), clamp(l + 5, 15, 25), 0.8)
			: hslA(h, 40, 93, 0.8),
		'--color-info-fg': isDark
			? hsl(h, 35, 75)
			: hsl(h, 50, 35),

		'--color-terminal-bg': isDark
			? hsl(h, clamp(s * 0.5, 0, 10), clamp(l - 5, 3, 12))
			: hsl(210, 15, 8),
		'--color-terminal-fg': isDark
			? hsl(120, 40, 65)
			: hsl(90, 50, 55),

		'--color-indicator-connecting': hsl(45, 65, isDark ? 60 : 55),
		'--color-indicator-running': hsl(140, 55, isDark ? 55 : 45),
		'--color-indicator-stopped': hsl(0, 55, isDark ? 55 : 50),
		'--color-indicator-led': hsl(140, 55, isDark ? 55 : 45),
		'--color-indicator-ir': hsl(290, 45, isDark ? 60 : 50),

		'--color-jumper': isDark ? hsl(h, 10, 85) : hsl(h, 10, 25),
	}
}

// ── 3D scene palette ────────────────────────────────────────

export const SCENE_3D = {
	pcb: 0x1c3824,
	wallFill: 0x4a6888,
	wallOpacity: 0.35,
	lidFill: 0x5a7898,
	lidOpacity: 0.18,
	outline: 0x90c8ff,
	cutoutHighlight: 0xffdd66,
	componentPalette: [
		0x4ea8d8, 0x52d474, 0xeeb830, 0xee6e6e, 0xb890e8,
		0x40c0d0, 0x60e090, 0xd8b040, 0xe88080, 0x90d0e0,
	],
} as const

export const SVG_PALETTE = [
	'#58a6ff', '#3fb950', '#d29922', '#f778ba', '#bc8cff',
	'#79c0ff', '#56d364', '#e3b341', '#ff7b72', '#a5d6ff',
] as const

// ── Theme application ───────────────────────────────────────

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
