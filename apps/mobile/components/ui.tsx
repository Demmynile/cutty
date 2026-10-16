import type { ReactNode } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { statusColor } from '@/constants'

// Small shared building blocks for the Cutty Pro and chat screens. Gold
// buttons carry dark text (#111) — white on gold fails contrast.

export function ScreenHeader({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  return (
    <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
      {back && (
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
      )}
      <View className="flex-1">
        <Text className="text-fg text-xl font-bold" numberOfLines={1}>{title}</Text>
        {subtitle && <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}

export function PrimaryButton({ label, onPress, loading, disabled, icon }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const off = disabled || loading
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${off && !loading ? 'bg-dark-600' : 'bg-primary-500'}`}
    >
      {loading ? (
        <ActivityIndicator color="#111111" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={off ? '#888888' : '#111111'} />}
          <Text className="text-lg font-bold" style={{ color: off ? '#888888' : '#111111' }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

export function SecondaryButton({ label, onPress, icon, tone = 'default', small }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; tone?: 'default' | 'danger' | 'gold'; small?: boolean }) {
  const color = tone === 'danger' ? '#F87171' : tone === 'gold' ? '#F1A91F' : undefined
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      className={`${small ? 'px-3 py-2 rounded-xl' : 'py-3.5 rounded-2xl'} items-center flex-row justify-center gap-2 bg-dark-700 border ${tone === 'danger' ? 'border-red-500/30' : tone === 'gold' ? 'border-primary-500/50' : 'border-dark-600'}`}
    >
      {icon && <Ionicons name={icon} size={small ? 14 : 18} color={color ?? '#A8A8A8'} />}
      <Text className={`${small ? 'text-xs' : 'text-base'} font-semibold ${color ? '' : 'text-fg'}`} style={color ? { color } : undefined}>{label}</Text>
    </TouchableOpacity>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`bg-dark-800 rounded-2xl p-4 ${className}`}>{children}</View>
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-fg font-bold text-lg">{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={8}>
          <Text className="text-primary-400 text-sm">{action.label} →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="items-center py-12 px-8">
      <Ionicons name={icon} size={48} className="text-dark-600" />
      <Text className="text-fg text-lg font-bold mt-4 text-center">{title}</Text>
      {body && <Text className="text-dark-400 text-center mt-2">{body}</Text>}
      {action && (
        <TouchableOpacity className="bg-primary-500 mt-5 px-6 py-3 rounded-xl" onPress={action.onPress}>
          <Text className="font-semibold" style={{ color: '#111111' }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function Chip({ label, selected, onPress, onRemove }: { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      disabled={!onPress && !onRemove}
      onPress={onPress ?? onRemove}
      className={`px-3.5 py-2 rounded-full border flex-row items-center gap-1.5 ${selected ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'}`}
    >
      <Text className={`text-sm font-medium ${selected ? '' : 'text-dark-200'}`} style={selected ? { color: '#111111' } : undefined}>{label}</Text>
      {onRemove && <Ionicons name="close" size={14} color={selected ? '#111111' : '#888888'} />}
    </TouchableOpacity>
  )
}

export function Banner({ tone, title, body, action }: { tone: 'info' | 'warning' | 'danger' | 'success'; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const palette = {
    info: { bg: 'bg-primary-500/10', border: 'border-primary-500/30', icon: 'information-circle' as const, color: '#F1A91F' },
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: 'time' as const, color: '#FACC15' },
    danger: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'alert-circle' as const, color: '#F87171' },
    success: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'checkmark-circle' as const, color: '#4ADE80' },
  }[tone]
  return (
    <View className={`${palette.bg} border ${palette.border} rounded-2xl p-4 flex-row gap-3`}>
      <Ionicons name={palette.icon} size={22} color={palette.color} />
      <View className="flex-1">
        <Text className="text-fg font-semibold">{title}</Text>
        {body && <Text className="text-dark-300 text-sm mt-1">{body}</Text>}
        {action && (
          <TouchableOpacity onPress={action.onPress} className="mt-2" hitSlop={8}>
            <Text className="font-semibold text-sm" style={{ color: palette.color }}>{action.label} →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export function StatusPill({ status }: { status: string }) {
  const c = statusColor(status)
  return (
    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: c + '33' }}>
      <Text className="text-xs font-semibold capitalize" style={{ color: c }}>{status.replace(/_/g, ' ')}</Text>
    </View>
  )
}

export function Loading() {
  return (
    <View className="flex-1 bg-dark-900 items-center justify-center">
      <ActivityIndicator color="#D4891A" size="large" />
    </View>
  )
}
