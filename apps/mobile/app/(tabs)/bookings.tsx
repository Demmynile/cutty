import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { sanityClient } from '@/lib/sanity'
import { BOOKINGS_BY_CUSTOMER } from '@/lib/queries'
import { Booking, BookingStatus } from '@cutty/types'
import { formatPrice } from '@/lib/sanity'
import { Ionicons } from '@expo/vector-icons'

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  in_progress: '#8B5CF6',
  completed: '#22C55E',
  cancelled: '#EF4444',
  no_show: '#6B7280',
}

const FILTERS: Array<BookingStatus | 'all'> = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function BookingsScreen() {
  const { customer } = useAuthStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchBookings() {
    if (!customer) return
    const data = await sanityClient.fetch(BOOKINGS_BY_CUSTOMER, { customerId: customer._id })
    setBookings(data)
  }

  useEffect(() => {
    fetchBookings().finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  return (
    <View className="flex-1 bg-dark-900">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">My Bookings</Text>
          <TouchableOpacity
            className="bg-primary-500 px-4 py-2 rounded-xl flex-row items-center gap-2"
            onPress={() => router.push('/booking/new')}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text className="text-white text-sm font-medium">New</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              className={`px-4 py-2 rounded-full ${filter === f ? 'bg-primary-500' : 'bg-dark-700'}`}
              onPress={() => setFilter(f)}
            >
              <Text className={`text-sm font-medium capitalize ${filter === f ? 'text-white' : 'text-dark-300'}`}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#D4891A" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Ionicons name="calendar-outline" size={64} color="#484848" />
          <Text className="text-white text-xl font-bold mt-4 text-center">No bookings yet</Text>
          <Text className="text-dark-400 text-center mt-2">Book your first appointment to get started</Text>
          <TouchableOpacity className="bg-primary-500 mt-6 px-8 py-3 rounded-xl" onPress={() => router.push('/booking/new')}>
            <Text className="text-white font-semibold">Book Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchBookings(); setRefreshing(false) }} tintColor="#D4891A" />}
        >
          {filtered.map((booking) => (
            <TouchableOpacity
              key={booking._id}
              className="bg-dark-800 rounded-2xl p-4"
              onPress={() => router.push(`/booking/${booking._id}`)}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">{booking.bookingDate}</Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    {booking.startTime} · {booking.barber?.name}
                  </Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    {booking.services?.map((s) => s.name).join(', ')}
                  </Text>
                </View>
                <View className="items-end gap-2">
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: STATUS_COLOR[booking.status] + '33' }}>
                    <Text className="text-xs font-medium capitalize" style={{ color: STATUS_COLOR[booking.status] }}>
                      {booking.status.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text className="text-white font-bold">{formatPrice(booking.totalAmount)}</Text>
                </View>
              </View>
              {booking.pointsEarned > 0 && (
                <View className="mt-3 pt-3 border-t border-dark-700 flex-row items-center gap-2">
                  <Text className="text-primary-400 text-xs">⭐ {booking.pointsEarned} points earned</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
