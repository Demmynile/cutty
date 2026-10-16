import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native'
import { router } from 'expo-router'
import { styleLabel, type Booking, type BookingStatus } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'
import { useBookings, usePullToRefresh } from '@/lib/data'
import { useFormatPrice } from '@/lib/currency'
import { statusColor } from '@/constants'

const FILTERS: Array<BookingStatus | 'all'> = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

export default function BookingsScreen() {
  const formatPrice = useFormatPrice()
  const { data: bookings = [], isLoading, refetch } = useBookings()
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all')
  const { refreshing, onRefresh } = usePullToRefresh(refetch)

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  function renderItem({ item: booking }: { item: Booking }) {
    const color = statusColor(booking.status)
    return (
      <TouchableOpacity className="bg-dark-800 rounded-2xl p-4" onPress={() => router.push(`/booking/${booking._id}`)}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-fg font-bold text-base">{booking.bookingDate}</Text>
            <Text className="text-dark-400 text-sm mt-1">
              {booking.startTime} · {booking.barber?.name}
            </Text>
            {booking.style && <Text className="text-dark-400 text-sm mt-1">{styleLabel(booking.style)}</Text>}
          </View>
          <View className="items-end gap-2">
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: color + '33' }}>
              <Text className="text-xs font-medium capitalize" style={{ color }}>
                {booking.status.replace('_', ' ')}
              </Text>
            </View>
            <Text className="text-fg font-bold">{formatPrice(booking.totalAmount)}</Text>
          </View>
        </View>
        {booking.pointsEarned > 0 && (
          <View className="mt-3 pt-3 border-t border-dark-700 flex-row items-center gap-2">
            <Text className="text-primary-400 text-xs">⭐ {booking.pointsEarned} points earned</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 bg-dark-900">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-fg text-2xl font-bold">My Bookings</Text>
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#D4891A" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Ionicons name="calendar-outline" size={64} className="text-dark-600" />
          <Text className="text-fg text-xl font-bold mt-4 text-center">No bookings yet</Text>
          <Text className="text-dark-400 text-center mt-2">Book your first appointment to get started</Text>
          <TouchableOpacity className="bg-primary-500 mt-6 px-8 py-3 rounded-xl" onPress={() => router.push('/booking/new')}>
            <Text className="text-white font-semibold">Book Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          initialNumToRender={8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4891A" />}
        />
      )}
    </View>
  )
}
