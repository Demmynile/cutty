import { useColorScheme } from 'react-native'
import { cssInterop, vars } from 'nativewind'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore } from '@/store/themeStore'

// Lets icons take theme colors via className, e.g. <Ionicons className="text-fg" />.
cssInterop(Ionicons as any, { className: { target: 'style', nativeStyleToProp: { color: true } } })

// The `dark-*` scale, `fg` and `primary-400` in tailwind.config.js resolve to
// these CSS variables, so every className in the app re-themes automatically.
// Light mode inverts the gray scale: dark-900 is the page, dark-800 cards, etc.
const PALETTES = {
  dark: {
    fg: '#FFFFFF',
    'primary-400': '#F1A91F',
    'dark-50': '#F8F8F8',
    'dark-100': '#E8E8E8',
    'dark-200': '#C8C8C8',
    'dark-300': '#A8A8A8',
    'dark-400': '#888888',
    'dark-500': '#686868',
    'dark-600': '#484848',
    'dark-700': '#282828',
    'dark-800': '#1A1A1A',
    'dark-900': '#111111',
  },
  light: {
    fg: '#111111',
    'primary-400': '#B86915',
    'dark-50': '#111111',
    'dark-100': '#1F1F1F',
    'dark-200': '#333333',
    'dark-300': '#4A4A4A',
    'dark-400': '#6B6B6B',
    'dark-500': '#8A8A8A',
    'dark-600': '#B4B4B4',
    'dark-700': '#E4E4E7',
    'dark-800': '#FFFFFF',
    'dark-900': '#F4F4F5',
  },
} as const

export type ColorScheme = keyof typeof PALETTES
export type ThemeColors = (typeof PALETTES)[ColorScheme]

function hexToChannels(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

const THEME_VARS = Object.fromEntries(
  (Object.keys(PALETTES) as ColorScheme[]).map((scheme) => [
    scheme,
    vars(
      Object.fromEntries(
        Object.entries(PALETTES[scheme]).map(([k, hex]) => [`--color-${k}`, hexToChannels(hex)])
      )
    ),
  ])
) as Record<ColorScheme, ReturnType<typeof vars>>

/** For branded screens (onboarding, welcome) whose artwork is always dark. */
export const DARK_THEME_VARS = THEME_VARS.dark

export function useColorSchemeSetting(): ColorScheme {
  const mode = useThemeStore((s) => s.mode)
  const system = useColorScheme()
  if (mode === 'system') return system === 'light' ? 'light' : 'dark'
  return mode
}

/** Resolved palette for props that can't take a className (icon colors, placeholders, tab bar). */
export function useTheme() {
  const scheme = useColorSchemeSetting()
  return { scheme, colors: PALETTES[scheme], themeVars: THEME_VARS[scheme] }
}
