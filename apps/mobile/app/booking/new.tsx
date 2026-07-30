import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useEffect } from 'react'
import { sanityClient, writeClient, urlFor, formatPrice } from '@/lib/sanity'
import { SERVICES_ACTIVE, BARBERS_AVAILABLE, DISCOUNT_CODE_BY_CODE } from '@/lib/queries'
import type { Service, Barber, DiscountCode } from '@cutty/types'
import { useBookingStore } from '@/store/bookingStore'
import { useAuthStore } from '@/store/authStore'
import { Ionicons } from '@expo/vector-icons'

const STEPS = ['Service', 'Barber', 'Date & Time', 'Confirm']
const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']

export default function NewBookingScreen() {
  const [step, setStep] = useState(0)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const { draft, addService, removeService, setBarber, setDate, setTime, setNotes, setDiscountCode, resetDraft, totalAmount, totalDuration, totalPoints, discount, finalAmount } = useBookingStore()
  const { customer, updateCustomer } = useAuthStore()

  useEffect(() => {
    Promise.all([
      sanityClient.fetch(SERVICES_ACTIVE),
      sanityClient.fetch(BARBERS_AVAILABLE),
    ]).then(([svcs, brbs]) => {
      setServices(svcs)
      setBarbers(brbs)
    }).finally(() => setLoading(false))
  }, [])

  async function applyDiscountCode() {
    if (!discountInput.trim()) return
    setValidatingCode(true)
    try {
      const code: DiscountCode = await sanityClient.fetch(DISCOUNT_CODE_BY_CODE, { code: discountInput.trim().toUpperCase() })
      if (!code) { Alert.alert('Invalid Code', 'Discount code not found or expired.'); return }
      if (code.applicableTo === 'order') { Alert.alert('Invalid', 'This code is only valid for product orders.'); return }
      if (code.validUntil && new Date(code.validUntil) < new Date()) { Alert.alert('Expired', 'This discount code has expired.'); return }
      if (code.maxUses && code.usedCount >= code.maxUses) { Alert.alert('Used Up', 'This code has reached its usage limit.'); return }
      if (code.customer && code.customer._id !== customer?._id) { Alert.alert('Invalid', 'This code is not valid for your account.'); return }
      setDiscountCode(code)
      Alert.alert('Applied! 🎉', `Discount code "${code.code}" applied.`)
    } catch {
      Alert.alert('Error', 'Failed to validate code.')
    } finally {
      setValidatingCode(false)
    }
  }

  async function confirmBooking() {
    if (!customer || !draft.barber || !draft.date || !draft.time || draft.services.length === 0) return
    setSubmitting(true)
    try {
      const total = finalAmount()
      const pointsEarned = totalPoints()

      const booking = await writeClient.create({
        _type: 'booking',
        customer: { _type: 'reference', _ref: customer._id },
        barber: { _type: 'reference', _ref: draft.barber._id },
        services: draft.services.map((s) => ({ _type: 'reference', _ref: s._id, _key: s._id })),
        bookingDate: draft.date,
        startTime: draft.time,
        totalAmount: totalAmount(),
        discountAmount: discount(),
        pointsEarned,
        paymentMethod: 'cash',
        status: 'pending',
        notes: draft.notes,
        ...(draft.discountCode ? { discountCode: { _type: 'reference', _ref: draft.discountCode._id } } : {}),
        createdAt: new Date().toISOString(),
      })

      // Award loyalty points
      const newPoints = customer.loyaltyPoints + pointsEarned
      const newVisits = customer.totalVisits + 1
      await writeClient.patch(customer._id).set({ loyaltyPoints: newPoints, totalVisits: newVisits }).commit()

      await writeClient.create({
        _type: 'loyaltyTransaction',
        customer: { _type: 'reference', _ref: customer._id },
        type: 'earn',
        points: pointsEarned,
        balanceAfter: newPoints,
        description: 'Points earned from booking',
        source: 'booking',
        referenceId: booking._id,
        createdAt: new Date().toISOString(),
      })

      updateCustomer({ loyaltyPoints: newPoints, totalVisits: newVisits })
      resetDraft()
      Alert.alert('Booking Confirmed! ✅', `Your appointment is scheduled for ${draft.date} at ${draft.time}.`, [
        { text: 'View Booking', onPress: () => router.replace(`/booking/${booking._id}`) },
      ])
    } catch {
      Alert.alert('Error', 'Failed to create booking. Please try again.')
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
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Book Appointment</Text>
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
                    <Text className="text-white font-semibold">{service.name}</Text>
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
                  <Text className="text-white font-semibold">{barber.name}</Text>
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
                      <Text className={`text-xl font-bold ${selected ? 'text-white' : 'text-white'}`}>{num}</Text>
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
                className="bg-dark-800 text-white px-4 py-3 rounded-xl border border-dark-700 h-24"
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
              <Text className="text-white font-bold text-lg">Booking Summary</Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Services</Text>
                  <Text className="text-white">{draft.services.map((s) => s.name).join(', ')}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Barber</Text>
                  <Text className="text-white">{draft.barber?.name}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Date & Time</Text>
                  <Text className="text-white">{draft.date} at {draft.time}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Duration</Text>
                  <Text className="text-white">{totalDuration()} minutes</Text>
                </View>
              </View>
              <View className="border-t border-dark-700 pt-4 gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Subtotal</Text>
                  <Text className="text-white">{formatPrice(totalAmount())}</Text>
                </View>
                {discount() > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-green-400">Discount ({draft.discountCode?.code})</Text>
                    <Text className="text-green-400">-{formatPrice(discount())}</Text>
                  </View>
                )}
                <View className="flex-row justify-between">
                  <Text className="text-white font-bold text-lg">Total</Text>
                  <Text className="text-primary-400 font-bold text-lg">{formatPrice(finalAmount())}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-primary-400 text-sm">Points to earn</Text>
                  <Text className="text-primary-400 text-sm font-medium">+{totalPoints()} pts</Text>
                </View>
              </View>
            </View>

            {/* Discount Code */}
            <View className="bg-dark-800 rounded-2xl p-4">
              <Text className="text-white font-medium mb-3">Discount Code</Text>
              <View className="flex-row gap-3">
                <TextInput
                  className="flex-1 bg-dark-700 text-white px-4 py-3 rounded-xl border border-dark-600"
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
