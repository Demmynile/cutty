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

// Booking and order statuses share one palette across the app.
export const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  in_progress: '#8B5CF6',
  completed: '#22C55E',
  cancelled: '#EF4444',
  no_show: '#6B7280',
  paid: '#3B82F6',
  processing: '#8B5CF6',
  shipped: '#06B6D4',
  delivered: '#22C55E',
  refunded: '#6B7280',
}

export const statusColor = (status: string) => STATUS_COLORS[status] ?? '#888888'

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
