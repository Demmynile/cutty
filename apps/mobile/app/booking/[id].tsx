import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { imageUri } from '@/lib/sanity'
import { api, errorMessage } from '@/lib/api'
import { keys, queryClient, useBooking } from '@/lib/data'
import { statusColor } from '@/constants'
import { styleLabel, type Booking } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'
import { useFormatPrice } from '@/lib/currency'

export default function BookingDetailScreen() {
  const formatPrice = useFormatPrice()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: booking, isLoading: loading } = useBooking(id)
  const [cancelling, setCancelling] = useState(false)

  async function cancelBooking() {
    if (!booking) return
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Booking', style: 'destructive', onPress: async () => {
          setCancelling(true)
          try {
            await api('POST', `/api/v1/bookings/${encodeURIComponent(booking._id)}/cancel`)
            queryClient.setQueryData<Booking>(keys.booking(booking._id), { ...booking, status: 'cancelled' })
            queryClient.invalidateQueries({ queryKey: keys.bookings, exact: true })
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'Could not cancel this booking.'))
          } finally {
            setCancelling(false)
          }
        },
      },
    ])
  }

  if (loading) return <View className="flex-1 bg-dark-900 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
  if (!booking) return <View className="flex-1 bg-dark-900 items-center justify-center"><Text className="text-dark-400">Booking not found</Text></View>

  const color = statusColor(booking.status)

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} className="text-fg" /></TouchableOpacity>
        <Text className="text-fg text-xl font-bold">Booking Details</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Status */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-fg font-bold text-lg">{booking.bookingDate}</Text>
            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: color + '33' }}>
              <Text className="font-medium capitalize" style={{ color }}>{booking.status.replace('_', ' ')}</Text>
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
                <Image source={{ uri: imageUri(booking.barber.photo, 96, 96) }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : (
                <Text className="text-primary-400 text-xl font-bold">{booking.barber?.name?.charAt(0)}</Text>
              )}
            </View>
            <Text className="text-fg font-semibold text-lg">{booking.barber?.name}</Text>
          </View>
        </View>

        {/* Style */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <Text className="text-dark-400 text-sm mb-3">STYLE</Text>
          <Text className="text-fg">{booking.style ? styleLabel(booking.style) : 'Decide with your stylist'}</Text>
        </View>

        {/* Payment */}
        <View className="bg-dark-800 rounded-2xl p-5">
          <Text className="text-dark-400 text-sm mb-3">PAYMENT</Text>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-dark-400">Subtotal</Text>
              <Text className="text-fg">{formatPrice(booking.totalAmount + booking.discountAmount)}</Text>
            </View>
            {booking.discountAmount > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-green-400">Discount</Text>
                <Text className="text-green-400">-{formatPrice(booking.discountAmount)}</Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-fg font-bold">Total Paid</Text>
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
            <Text className="text-fg">{booking.notes}</Text>
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
