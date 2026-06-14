export const COLORS = {
  primary: '#D4891A',
  primaryLight: '#F4BC4F',
  primaryDark: '#9B490F',
  dark: '#111111',
  darkMid: '#1A1A1A',
  darkCard: '#282828',
  gray: '#888888',
  grayLight: '#C8C8C8',
  white: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const

export const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export const TIER_THRESHOLDS = {
  silver: 5,
  gold: 15,
  platinum: 30,
}

export const POINTS_PER_100_NAIRA = 1
export const POINTS_TO_KOBO_RATE = 5000
