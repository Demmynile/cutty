import { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { router } from 'expo-router'
import { styleLabel, type BookingStatus } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { invalidate, keys, useProBookings, usePullToRefresh, useRefetchOnFocus } from '@/lib/data'
import { useAuthStore } from '@/store/authStore'
import { useFormatPrice } from '@/lib/currency'
import { Banner, Card, Chip, EmptyState, Loading, SecondaryButton, StatusPill } from '@/components/ui'

type ProBooking = {
  _id: string; bookingDate: string; startTime: string; endTime?: string; status: BookingStatus; totalAmount: number
  discountAmount?: number; notes?: string
  customer: { _id: string; fullName: string; phone?: string; tier?: string }
  style?: string
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'pending', label: 'To confirm' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
]

// What the stylist can do next with each booking (enforced again by the server).
const NEXT: Partial<Record<BookingStatus, Array<{ to: BookingStatus; label: string; tone?: 'gold' | 'danger' }>>> = {
  pending: [{ to: 'confirmed', label: 'Confirm', tone: 'gold' }, { to: 'cancelled', label: 'Decline', tone: 'danger' }],
  confirmed: [{ to: 'in_progress', label: 'Start', tone: 'gold' }, { to: 'no_show', label: 'No-show' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  in_progress: [{ to: 'completed', label: 'Complete', tone: 'gold' }],
}

export default function ScheduleScreen() {
  const formatPrice = useFormatPrice()
  const stylist = useAuthStore((s) => s.stylist)
  const [filter, setFilter] = useState('upcoming')
  const approved = stylist?.status === 'approved'
  const status = filter === 'upcoming' || filter === 'all' ? 'all' : filter
  const q = useProBookings(status, approved)
  const { refreshing, onRefresh } = usePullToRefresh(q.refetch)
  useRefetchOnFocus(q.refetch)

  const bookings = useMemo(() => {
    if (q.isLoading) return null
    const rows = (q.data ?? []) as unknown as ProBooking[]
    const today = new Date().toISOString().slice(0, 10)
    return filter === 'upcoming'
      ? rows.filter((b) => b.bookingDate >= today && ['pending', 'confirmed', 'in_progress'].includes(b.status)).reverse()
      : rows
  }, [q.data, q.isLoading, filter])

  async function move(b: ProBooking, to: BookingStatus, label: string) {
    const go = async () => {
      try {
        await api('POST', `/api/v1/pro/bookings/${b._id}/status`, { status: to })
        await invalidate(keys.pro.dashboard, ['pro', 'bookings'], keys.pro.customers)
      } catch (err) {
        Alert.alert('Not updated', errorMessage(err))
      }
    }
    if (to === 'cancelled' || to === 'no_show') {
      Alert.alert(`${label} this booking?`, `${b.customer.fullName}, ${b.bookingDate} at ${b.startTime}`, [
        { text: 'Keep', style: 'cancel' },
        { text: label, style: 'destructive', onPress: go },
      ])
    } else {
      go()
    }
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <Text className="text-fg text-2xl font-bold mb-4">Schedule</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />)}
        </ScrollView>
      </View>

      {!approved ? (
        <View className="p-5"><Banner tone="warning" title="Bookings open after approval" body="Customers can book you once Cutty approves your profile." /></View>
      ) : bookings === null ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D4891A" onRefresh={onRefresh} />}
        >
          {bookings.length === 0 && (
            <EmptyState icon="calendar-outline" title="Nothing here" body="Keep your hours up to date so customers can find free times." action={{ label: 'Edit hours', onPress: () => router.push('/pro/availability') }} />
          )}
          {bookings.map((b) => (
            <Card key={b._id}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-fg font-bold text-base">{b.bookingDate} · {b.startTime}{b.endTime ? `–${b.endTime}` : ''}</Text>
                  <Text className="text-fg mt-1">{b.customer.fullName}</Text>
                  {b.style && <Text className="text-dark-400 text-sm mt-0.5">{styleLabel(b.style)}</Text>}
                  {b.notes ? <Text className="text-dark-300 text-xs mt-2">“{b.notes}”</Text> : null}
                </View>
                <View className="items-end gap-2">
                  <StatusPill status={b.status} />
                  <Text className="text-fg font-bold">{formatPrice(b.totalAmount - (b.discountAmount ?? 0))}</Text>
                </View>
              </View>
              {NEXT[b.status] && (
                <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-dark-700">
                  {NEXT[b.status]!.map((a) => <SecondaryButton key={a.to} small label={a.label} tone={a.tone} onPress={() => move(b, a.to, a.label)} />)}
                </View>
              )}
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
