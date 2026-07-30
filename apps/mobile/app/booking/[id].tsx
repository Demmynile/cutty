import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { sanityClient, writeClient, urlFor, formatPrice } from '@/lib/sanity'
import { BOOKING_BY_ID } from '@/lib/queries'
import type { Booking, BookingStatus } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: '#F59E0B', confirmed: '#3B82F6', in_progress: '#8B5CF6',
  completed: '#22C55E', cancelled: '#EF4444', no_show: '#6B7280',
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    sanityClient.fetch(BOOKING_BY_ID, { id }).then(setBooking).finally(() => setLoading(false))
  }, [id])

  async function cancelBooking() {
    if (!booking) return
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Booking', style: 'destructive', onPress: async () => {
          setCancelling(true)
          await writeClient.patch(booking._id).set({ status: 'cancelled', cancelReason: 'Cancelled by customer' }).commit()
          setBooking({ ...booking, status: 'cancelled' })
          setCancelling(false)
        },
      },
    ])
  }

  if (loading) return <View className="flex-1 bg-dark-900 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
  if (!booking) return <View className="flex-1 bg-dark-900 items-center justify-center"><Text className="text-dark-400">Booking not found</Text></View>

  const statusColor = STATUS_COLOR[booking.status]

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold">Booking Details</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Status */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-white font-bold text-lg">{booking.bookingDate}</Text>
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: statusColor + '33' }}>
              <Text className="font-medium capitalize" style={{ color: statusColor }}>{booking.status.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text className="text-dark-400 mt-2">{booking.startTime}{booking.endTime ? ` – ${booking.endTime}` : ''}</Text>
        </View>

        {/* Barber */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <Text className="text-dark-400 text-sm mb-3">BARBER</Text>
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full bg-dark-700 overflow-hidden items-center justify-center">
              {booking.barber?.photo ? (
                <Image source={{ uri: urlFor(booking.barber.photo).width(96).url() }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : (
                <Text className="text-primary-400 text-xl font-bold">{booking.barber?.name?.charAt(0)}</Text>
              )}
            </View>
            <Text className="text-white font-semibold text-lg">{booking.barber?.name}</Text>
          </View>
        </View>

        {/* Services */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <Text className="text-dark-400 text-sm mb-3">SERVICES</Text>
          {booking.services?.map((s) => (
            <View key={s._id} className="flex-row justify-between py-2 border-b border-dark-700 last:border-0">
              <Text className="text-white">{s.name}</Text>
              <Text className="text-primary-400">{formatPrice(s.price)}</Text>
            </View>
          ))}
        </View>

        {/* Payment */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <Text className="text-dark-400 text-sm mb-3">PAYMENT</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-dark-400">Subtotal</Text>
              <Text className="text-white">{formatPrice(booking.totalAmount + booking.discountAmount)}</Text>
            </View>
            {booking.discountAmount > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-green-400">Discount</Text>
                <Text className="text-green-400">-{formatPrice(booking.discountAmount)}</Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-white font-bold">Total Paid</Text>
              <Text className="text-primary-400 font-bold">{formatPrice(booking.totalAmount)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-primary-400 text-sm">Points Earned</Text>
              <Text className="text-primary-400 text-sm">+{booking.pointsEarned} pts</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {booking.notes && (
          <View className="bg-dark-800 rounded-2xl p-5">
            <Text className="text-dark-400 text-sm mb-2">NOTES</Text>
            <Text className="text-white">{booking.notes}</Text>
          </View>
        )}

        {/* Cancel */}
        {['pending', 'confirmed'].includes(booking.status) && (
          <TouchableOpacity
            className="border border-red-500/40 rounded-2xl p-4 items-center"
            onPress={cancelBooking}
            disabled={cancelling}
          >
            {cancelling ? <ActivityIndicator color="#EF4444" /> : <Text className="text-red-400 font-medium">Cancel Appointment</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}
