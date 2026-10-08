import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { urlFor } from '@/lib/sanity'
import { api, errorMessage } from '@/lib/api'
import { TRY_ON_STYLES } from '@cutty/types'
import type { Service, Barber, DiscountCode } from '@cutty/types'
import { useBookingStore } from '@/store/bookingStore'
import { useAuthStore } from '@/store/authStore'
import { getStyleImage } from '@/lib/styleImages'
import { Ionicons } from '@expo/vector-icons'
import { useFormatPrice, usePreferredCurrency } from '@/lib/currency'

const STEPS = ['Service', 'Stylist', 'Date & Time', 'Confirm']
const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']

export default function NewBookingScreen() {
  const formatPrice = useFormatPrice()
  const currency = usePreferredCurrency()
  const [step, setStep] = useState(0)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const [styleGender, setStyleGender] = useState<'male' | 'female'>('male')
  const { draft, addService, removeService, setBarber, setDate, setTime, setNotes, setDiscountCode, resetDraft, totalAmount, totalDuration, totalPoints, discount, finalAmount } = useBookingStore()
  const { customer } = useAuthStore()

  useEffect(() => {
    Promise.all([
      api<Service[]>('GET', '/api/v1/catalog/services'),
      api<Barber[]>('GET', '/api/v1/catalog/barbers'),
    ]).then(([svcs, brbs]) => {
      setServices(svcs)
      setBarbers(brbs)
    }).finally(() => setLoading(false))
  }, [])

  async function applyDiscountCode() {
    if (!discountInput.trim()) return
    setValidatingCode(true)
    try {
      const code = await api<DiscountCode>('POST', '/api/v1/discounts/validate', {
        code: discountInput.trim().toUpperCase(), context: 'booking', subtotal: totalAmount(),
      })
      setDiscountCode(code)
      Alert.alert('Applied! 🎉', `Discount code "${code.code}" applied.`)
    } catch (err) {
      Alert.alert('Invalid Code', errorMessage(err, 'Failed to validate code.'))
    } finally {
      setValidatingCode(false)
    }
  }

  async function confirmBooking() {
    if (!customer || !draft.barber || !draft.date || !draft.time || draft.services.length === 0) return
    setSubmitting(true)
    try {
      // Price, discount and points are recomputed by the server from the
      // service records; points are credited once the visit is completed.
      const booking = await api<{ _id: string }>('POST', '/api/v1/bookings', {
        serviceIds: draft.services.map((s) => s._id),
        barberId: draft.barber._id,
        date: draft.date,
        time: draft.time,
        notes: draft.notes || undefined,
        discountCode: draft.discountCode?.code,
      })
      resetDraft()
      Alert.alert('Booking Confirmed! ✅', `Your appointment is scheduled for ${draft.date} at ${draft.time}.`, [
        { text: 'View Booking', onPress: () => router.replace(`/booking/${booking._id}`) },
      ])
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to create booking. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <View className="flex-1 bg-dark-900 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
  }

  return (
    <View className="flex-1 bg-dark-900">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center gap-4 mb-4">
          <TouchableOpacity onPress={() => step === 0 ? router.back() : setStep(step - 1)}>
            <Ionicons name="arrow-back" size={24} className="text-fg" />
          </TouchableOpacity>
          <Text className="text-fg text-xl font-bold">Book Appointment</Text>
        </View>
        {/* Step indicator */}
        <View className="flex-row gap-2">
          {STEPS.map((s, i) => (
            <View key={s} className="flex-1">
              <View className={`h-1 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-dark-600'}`} />
              <Text className={`text-xs mt-1 text-center ${i === step ? 'text-primary-400 font-medium' : 'text-dark-400'}`}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {/* Step 0: Select Services */}
        {step === 0 && (
          <View className="gap-3">
            {/* Style inspiration gallery */}
            <View className="mb-2">
              <View className="bg-primary-500/10 border border-primary-500/30 rounded-2xl p-4 flex-row items-center gap-3 mb-4">
                <Ionicons name="sparkles" size={20} color="#F1A91F" />
                <Text className="text-dark-100 text-sm flex-1">
                  Not sure what to book? Browse styles below, then head to the AI tab to try any of them on your own photo first.
                </Text>
              </View>

              <Text className="text-fg font-bold text-base mb-3">Style Inspiration</Text>

              <View className="flex-row bg-dark-800 rounded-full p-1 mb-4 self-start">
                {(['male', 'female'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setStyleGender(g)}
                    className={`px-5 py-2 rounded-full ${styleGender === g ? 'bg-primary-500' : ''}`}
                  >
                    <Text className={`text-sm font-semibold ${styleGender === g ? 'text-white' : 'text-dark-400'}`}>
                      {g === 'male' ? 'Men' : 'Women'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                {TRY_ON_STYLES.filter((s) => s.gender === styleGender || s.gender === 'unisex').map((s) => (
                  <View key={s.id} className="bg-dark-800 rounded-2xl overflow-hidden border border-dark-700" style={{ width: 140 }}>
                    <Image source={getStyleImage(s.id, styleGender)} style={{ width: '100%', height: 160 }} contentFit="cover" />
                    <View className="p-3 gap-1">
                      <Text className="text-fg font-semibold text-sm" numberOfLines={1}>{s.label}</Text>
                      <Text className="text-dark-400 text-xs" numberOfLines={2}>{s.blurb}</Text>
                      <TouchableOpacity
                        className="mt-2 bg-primary-500/15 border border-primary-500/40 rounded-full py-1.5 items-center flex-row justify-center gap-1"
                        onPress={() => router.push(`/ai/tryon?styleId=${s.id}`)}
                      >
                        <Ionicons name="color-wand-outline" size={12} color="#F1A91F" />
                        <Text className="text-primary-400 text-xs font-semibold">Try it on</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View className="h-px bg-dark-700 mb-2" />

            <Text className="text-dark-300 text-sm mb-2">Select one or more services</Text>
            {services.map((service) => {
              const selected = draft.services.some((s) => s._id === service._id)
              return (
                <TouchableOpacity
                  key={service._id}
                  className={`bg-dark-800 rounded-2xl p-4 flex-row items-center gap-4 border ${selected ? 'border-primary-500' : 'border-dark-700'}`}
                  onPress={() => selected ? removeService(service._id) : addService(service)}
                >
                  {service.image && (
                    <Image source={{ uri: urlFor(service.image).width(100).url() }} className="w-16 h-16 rounded-xl" contentFit="cover" />
                  )}
                  <View className="flex-1">
                    <Text className="text-fg font-semibold">{service.name}</Text>
                    <Text className="text-dark-400 text-sm">{service.duration} min</Text>
                    <Text className="text-primary-400 font-bold">{formatPrice(service.price)}</Text>
                  </View>
                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selected ? 'bg-primary-500 border-primary-500' : 'border-dark-500'}`}>
                    {selected && <Ionicons name="checkmark" size={14} color="white" />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Step 1: Select Barber */}
        {step === 1 && (
          <View className="gap-3">
            <Text className="text-dark-300 text-sm mb-2">Choose your barber</Text>
            {barbers.map((barber) => (
              <TouchableOpacity
                key={barber._id}
                className={`bg-dark-800 rounded-2xl p-4 flex-row items-center gap-4 border ${draft.barber?._id === barber._id ? 'border-primary-500' : 'border-dark-700'}`}
                onPress={() => setBarber(barber)}
              >
                <View className="w-14 h-14 rounded-full bg-dark-700 overflow-hidden items-center justify-center">
                  {barber.photo ? (
                    <Image source={{ uri: urlFor(barber.photo).width(112).url() }} style={{ width: 56, height: 56 }} contentFit="cover" />
                  ) : (
                    <Text className="text-primary-400 text-xl font-bold">{barber.name.charAt(0)}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-fg font-semibold">{barber.name}</Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text className="text-yellow-400 text-sm">{barber.rating?.toFixed(1)}</Text>
                    <Text className="text-dark-400 text-xs">({barber.totalReviews} reviews)</Text>
                  </View>
                  {barber.specialties && <Text className="text-dark-400 text-xs mt-1">{barber.specialties.join(', ')}</Text>}
                </View>
                <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${draft.barber?._id === barber._id ? 'bg-primary-500 border-primary-500' : 'border-dark-500'}`}>
                  {draft.barber?._id === barber._id && <Ionicons name="checkmark" size={14} color="white" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <View className="gap-6">
            <View>
              <Text className="text-dark-300 text-sm mb-3">Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {Array.from({ length: 14 }, (_, i) => {
                  const d = new Date()
                  d.setDate(d.getDate() + i + 1)
                  const dateStr = d.toISOString().split('T')[0]
                  const selected = draft.date === dateStr
                  const day = d.toLocaleDateString('en', { weekday: 'short' })
                  const num = d.getDate()
                  const month = d.toLocaleDateString('en', { month: 'short' })
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      className={`w-16 py-3 rounded-xl items-center border ${selected ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'}`}
                      onPress={() => setDate(dateStr)}
                    >
                      <Text className={`text-xs ${selected ? 'text-white' : 'text-dark-400'}`}>{day}</Text>
                      <Text className={`text-xl font-bold ${selected ? 'text-white' : 'text-fg'}`}>{num}</Text>
                      <Text className={`text-xs ${selected ? 'text-white' : 'text-dark-400'}`}>{month}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
            <View>
              <Text className="text-dark-300 text-sm mb-3">Select Time</Text>
              <View className="flex-row flex-wrap gap-3">
                {TIMES.map((time) => (
                  <TouchableOpacity
                    key={time}
                    className={`px-4 py-3 rounded-xl border ${draft.time === time ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'}`}
                    onPress={() => setTime(time)}
                  >
                    <Text className={`font-medium ${draft.time === time ? 'text-white' : 'text-dark-300'}`}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text className="text-dark-300 text-sm mb-3">Notes (optional)</Text>
              <TextInput
                className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700 h-24"
                placeholder="Any special requests..."
                placeholderTextColor="#686868"
                multiline
                value={draft.notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <View className="gap-5">
            <View className="bg-dark-800 rounded-2xl p-5 gap-4">
              <Text className="text-fg font-bold text-lg">Booking Summary</Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Services</Text>
                  <Text className="text-fg">{draft.services.map((s) => s.name).join(', ')}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Barber</Text>
                  <Text className="text-fg">{draft.barber?.name}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Date & Time</Text>
                  <Text className="text-fg">{draft.date} at {draft.time}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Duration</Text>
                  <Text className="text-fg">{totalDuration()} minutes</Text>
                </View>
              </View>
              <View className="border-t border-dark-700 pt-4 gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Subtotal</Text>
                  <Text className="text-fg">{formatPrice(totalAmount())}</Text>
                </View>
                {discount() > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-green-400">Discount ({draft.discountCode?.code})</Text>
                    <Text className="text-green-400">-{formatPrice(discount())}</Text>
                  </View>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-fg font-bold text-lg">Total</Text>
                  <Text className="text-primary-400 font-bold text-lg">{formatPrice(finalAmount())}</Text>
                </View>
                {currency !== 'NGN' && (
                  <Text className="text-dark-400 text-xs text-right">
                    Charged in Naira: ₦{(finalAmount() / 100).toLocaleString('en-NG')}
                  </Text>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-primary-400 text-sm">Points to earn</Text>
                  <Text className="text-primary-400 text-sm font-medium">+{totalPoints()} pts</Text>
                </View>
              </View>
            </View>

            {/* Discount Code */}
            <View className="bg-dark-800 rounded-2xl p-4">
              <Text className="text-fg font-medium mb-3">Discount Code</Text>
              <View className="flex-row gap-3">
                <TextInput
                  className="flex-1 bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600"
                  placeholder="Enter code..."
                  placeholderTextColor="#686868"
                  autoCapitalize="characters"
                  value={discountInput}
                  onChangeText={setDiscountInput}
                />
                <TouchableOpacity
                  className="bg-primary-500 px-4 rounded-xl items-center justify-center"
                  onPress={applyDiscountCode}
                  disabled={validatingCode}
                >
                  {validatingCode ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-medium">Apply</Text>}
                </TouchableOpacity>
              </View>
              {draft.discountCode && (
                <View className="mt-2 flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text className="text-green-400 text-sm">{draft.discountCode.code} applied</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 py-4 bg-dark-800 border-t border-dark-700">
        {step === 3 ? (
          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center"
            onPress={confirmBooking}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-bold">Confirm Booking — {formatPrice(finalAmount())}</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className={`py-4 rounded-2xl items-center ${
              (step === 0 && draft.services.length === 0) ||
              (step === 1 && !draft.barber) ||
              (step === 2 && (!draft.date || !draft.time))
                ? 'bg-dark-600'
                : 'bg-primary-500'
            }`}
            onPress={() => setStep(step + 1)}
            disabled={
              (step === 0 && draft.services.length === 0) ||
              (step === 1 && !draft.barber) ||
              (step === 2 && (!draft.date || !draft.time))
            }
          >
            <Text className="text-white text-lg font-bold">Continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
