interface BadgeProps {
  label: string
  color?: 'yellow' | 'blue' | 'purple' | 'green' | 'red' | 'gray' | 'cyan'
}

const COLOR_MAP: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  gray: 'bg-gray-500/20 text-gray-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
}

export function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${COLOR_MAP[color]}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

export function bookingStatusColor(status: string): BadgeProps['color'] {
  const map: Record<string, BadgeProps['color']> = {
    pending: 'yellow', confirmed: 'blue', in_progress: 'purple',
    completed: 'green', cancelled: 'red', no_show: 'gray',
  }
  return map[status] || 'gray'
}

export function orderStatusColor(status: string): BadgeProps['color'] {
  const map: Record<string, BadgeProps['color']> = {
    pending: 'yellow', paid: 'blue', processing: 'purple',
    shipped: 'cyan', delivered: 'green', cancelled: 'red', refunded: 'gray',
  }
  return map[status] || 'gray'
}
