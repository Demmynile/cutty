import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { api, errorMessage } from '@/lib/api'
import { keys, queryClient, useAvailability, useNearbyStylists, useStylist, useStylists } from '@/lib/data'
import { TRY_ON_STYLES, styleLabel } from '@cutty/types'
import type { DiscountCode, StylistPublic } from '@cutty/types'
import { useBookingStore } from '@/store/bookingStore'
import { useAuthStore } from '@/store/authStore'
import { getStyleImage } from '@/lib/styleImages'
import { formatDistance, useMyLocation } from '@/lib/location'
import { StylistAvatar } from '@/components/StylistAvatar'
import { Ionicons } from '@expo/vector-icons'
import { useFormatPrice, usePreferredCurrency } from '@/lib/currency'

const STEPS = ['Stylist', 'Style', 'Date & Time', 'Confirm']
const KIND_LABEL = { barber: 'Barber', braider: 'Braider', both: 'Barber & braider' } as const

/** Only stylists with a calendar and an appointment price can be booked. */
const bookable = (s: StylistPublic) => !!s.barberId && s.bookingPrice != null

// Customers book a stylist, not a service: pick one on the map or from the
// nearby/search list (or arrive from their profile with `stylistId`), choose
// one of their styles, then a free time. `style` (a try-on preset id) is
// preselected when the chosen stylist offers it.
export default function NewBookingScreen() {
  const formatPrice = useFormatPrice()
  const currency = usePreferredCurrency()
  const params = useLocalSearchParams<{ stylistId?: string; style?: string }>()
  const [step, setStep] = useState(params.stylistId ? 1 : 0)
  const [stylistId, setStylistId] = useState(params.stylistId)
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const { draft, setStylist, setStyle, setDate, setTime, setNotes, setDiscountCode, resetDraft, totalAmount, totalDuration, totalPoints, discount, finalAmount } = useBookingStore()
  const { customer } = useAuthStore()

  // The list: nearest first when we have the customer's position.
  const { position } = useMyLocation()
  const nearbyQ = useNearbyStylists(position)
  const allQ = useStylists()
  const stylistQ = useStylist(stylistId)
  const stylist = stylistQ.data ?? null

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (nearbyQ.data ?? allQ.data ?? []).filter(bookable).filter((s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      [s.location?.area, s.location?.city, s.location?.postcode].some((t) => t?.toLowerCase().includes(q)) ||
      s.skills.some((k) => k.toLowerCase().includes(q)) ||
      s.styles.some((st) => styleLabel(st).toLowerCase().includes(q)),
    )
    // Coming from a try-on: stylists who do that look go first.
    return params.style ? [...list].sort((a, b) => Number(b.styles.includes(params.style!)) - Number(a.styles.includes(params.style!))) : list
  }, [nearbyQ.data, allQ.data, query, params.style])
  const loadingList = !nearbyQ.data && !allQ.data && (allQ.isLoading || nearbyQ.isLoading)

  useEffect(() => { resetDraft() }, [])
  useEffect(() => {
    if (!stylist) return
    setStylist(stylist)
    if (params.style && stylist.styles.includes(params.style)) setStyle(params.style)
  }, [stylist])
  useEffect(() => {
    if (stylistQ.error) {
      Alert.alert('Unavailable', errorMessage(stylistQ.error, 'This stylist is not taking bookings right now.'))
      setStylistId(undefined)
      setStep(0)
    }
  }, [stylistQ.error])
  useEffect(() => {
    if (stylist && !bookable(stylist)) {
      Alert.alert('Not taking bookings yet', `${stylist.name} hasn't set an appointment price yet. You can message them from their profile.`)
      setStylistId(undefined)
      setStep(0)
    }
  }, [stylist])

  function chooseStylist(s: StylistPublic) {
    setStylistId(s._id)
    setStylist(s)
    if (params.style && s.styles.includes(params.style)) setStyle(params.style)
    setStep(1)
  }

  // Free times come from the server: the stylist's hours minus existing bookings.
  const barberId = draft.stylist?.barberId
  const slotsQ = useAvailability(barberId, draft.date, totalDuration())
  const slots = barberId && draft.date ? (slotsQ.isError ? [] : slotsQ.data ?? null) : null
  const loadingSlots = slotsQ.isLoading

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
    if (!customer || !barberId || !draft.date || !draft.time) return
    setSubmitting(true)
    try {
      // Price, discount and points are recomputed by the server from the
      // stylist's appointment price; points are credited once the visit is completed.
      const booking = await api<{ _id: string }>('POST', '/api/v1/bookings', {
        barberId,
        style: draft.style ?? undefined,
        date: draft.date,
        time: draft.time,
        notes: draft.notes || undefined,
        discountCode: draft.discountCode?.code,
      })
      resetDraft()
      queryClient.invalidateQueries({ queryKey: keys.bookings })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      Alert.alert('Booking Confirmed! ✅', `Your appointment is scheduled for ${draft.date} at ${draft.time}.`, [
        { text: 'View Booking', onPress: () => router.replace(`/booking/${booking._id}`) },
      ])
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to create booking. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const chosen = draft.stylist
  const canContinue = step === 1 ? true : step === 2 ? !!draft.date && !!draft.time : false
  const styles = chosen?.styles ?? []
  const section = chosen?.kind === 'braider' ? 'female' : 'male'

  return (
    <View className="flex-1 bg-dark-900">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center gap-4 mb-4">
          <TouchableOpacity onPress={() => step === 0 ? router.back() : setStep(step - 1)} accessibilityLabel="Back">
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

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Step 0: Choose a stylist on the map or from search */}
        {step === 0 && (
          <View className="gap-3">
            <TouchableOpacity
              className="bg-primary-500/10 border border-primary-500/40 rounded-2xl p-4 flex-row items-center gap-3"
              onPress={() => router.replace('/explore')}
              accessibilityRole="button"
            >
              <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center">
                <Ionicons name="map" size={20} color="#D4891A" />
              </View>
              <View className="flex-1">
                <Text className="text-fg font-semibold">Pick on the map</Text>
                <Text className="text-dark-400 text-xs mt-0.5">See stylists around you, nearest first</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#686868" />
            </TouchableOpacity>

            <View className="bg-dark-800 flex-row items-center px-4 py-3 rounded-xl gap-3 border border-dark-700">
              <Ionicons name="search" size={18} color="#686868" />
              <TextInput
                className="flex-1 text-fg text-sm"
                placeholder="Search name, area or style (e.g. locs)"
                placeholderTextColor="#686868"
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <Text className="text-dark-300 text-sm mt-1">{position ? 'Stylists near you' : 'Stylists'}</Text>
            {loadingList && <ActivityIndicator color="#D4891A" />}
            {!loadingList && candidates.length === 0 && (
              <Text className="text-dark-400 text-sm">No bookable stylists match. Try another search or look on the map.</Text>
            )}
            {candidates.map((s) => (
              <TouchableOpacity
                key={s._id}
                className="bg-dark-800 rounded-2xl p-4 flex-row items-center gap-4 border border-dark-700"
                onPress={() => chooseStylist(s)}
                accessibilityRole="button"
              >
                <StylistAvatar s={s} />
                <View className="flex-1">
                  <Text className="text-fg font-semibold">{s.name}</Text>
                  <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>
                    {KIND_LABEL[s.kind]}{s.rating ? ` · ★ ${s.rating.toFixed(1)}` : ' · New'}{s.location?.area ? ` · ${s.location.area}` : ''}
                  </Text>
                  <Text className="text-primary-400 text-sm font-bold mt-1">
                    {formatPrice(s.bookingPrice!)} <Text className="text-dark-400 text-xs font-normal">· {s.bookingDuration ?? 60} min</Text>
                  </Text>
                  {params.style && s.styles.includes(params.style) && (
                    <Text className="text-green-400 text-xs mt-1">Does {styleLabel(params.style)}</Text>
                  )}
                </View>
                {s.distanceKm !== undefined && <Text className="text-dark-300 text-xs">{formatDistance(s.distanceKm)}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 1: Pick one of the stylist's styles (optional) */}
        {step === 1 && (
          !chosen ? <ActivityIndicator color="#D4891A" size="large" /> : (
            <View className="gap-3">
              <View className="bg-dark-800 rounded-2xl p-4 flex-row items-center gap-4">
                <StylistAvatar s={chosen} />
                <View className="flex-1">
                  <Text className="text-fg font-semibold">{chosen.name}</Text>
                  <Text className="text-primary-400 font-bold mt-0.5">{formatPrice(totalAmount())} <Text className="text-dark-400 text-xs font-normal">· {totalDuration()} min</Text></Text>
                </View>
                <TouchableOpacity onPress={() => setStep(0)}><Text className="text-primary-400 text-sm font-semibold">Change</Text></TouchableOpacity>
              </View>

              <Text className="text-dark-300 text-sm mt-2">What would you like? (optional)</Text>
              <TouchableOpacity
                className={`bg-dark-800 rounded-2xl p-4 flex-row items-center gap-3 border ${draft.style === null ? 'border-primary-500' : 'border-dark-700'}`}
                onPress={() => setStyle(null)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#F1A91F" />
                <Text className="text-fg flex-1">Not sure yet, I'll decide with {chosen.name.split(' ')[0]}</Text>
                {draft.style === null && <Ionicons name="checkmark-circle" size={20} color="#D4891A" />}
              </TouchableOpacity>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {styles.map((st) => {
                  const preset = TRY_ON_STYLES.find((t) => t.id === st)
                  const img = preset ? getStyleImage(preset.id, preset.gender === 'female' ? 'female' : preset.gender === 'male' ? 'male' : section) : null
                  const selected = draft.style === st
                  return (
                    <View
                      key={st}
                      className={`bg-dark-800 rounded-2xl overflow-hidden border ${selected ? 'border-primary-500' : 'border-dark-700'}`}
                      style={{ width: '48%' }}
                    >
                      <TouchableOpacity onPress={() => setStyle(st)} accessibilityState={{ selected }}>
                        {img ? <Image source={img} style={{ width: '100%', height: 120 }} contentFit="cover" /> : (
                          <View className="h-16 bg-dark-700 items-center justify-center"><Ionicons name="cut-outline" size={22} color="#686868" /></View>
                        )}
                        <View className="p-3 flex-row items-center gap-2">
                          <Text className="text-fg font-semibold text-sm flex-1" numberOfLines={1}>{styleLabel(st)}</Text>
                          {selected && <Ionicons name="checkmark-circle" size={18} color="#D4891A" />}
                        </View>
                      </TouchableOpacity>
                      {preset && (
                        <TouchableOpacity onPress={() => router.push(`/ai/tryon?styleId=${preset.id}`)} className="px-3 pb-3 flex-row items-center gap-1">
                          <Ionicons name="color-wand-outline" size={12} color="#F1A91F" />
                          <Text className="text-primary-400 text-xs font-semibold">Try it on</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
            </View>
          )
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
              {!draft.date && <Text className="text-dark-400 text-sm">Pick a date to see free times.</Text>}
              {loadingSlots && <ActivityIndicator color="#D4891A" />}
              {!loadingSlots && slots?.length === 0 && (
                <Text className="text-dark-400 text-sm">No free times on this day. Try another date.</Text>
              )}
              <View className="flex-row flex-wrap gap-3">
                {!loadingSlots && (slots ?? []).map((time) => (
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
                  <Text className="text-dark-400">Stylist</Text>
                  <Text className="text-fg">{chosen?.name}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-400">Style</Text>
                  <Text className="text-fg">{draft.style ? styleLabel(draft.style) : 'Decide with stylist'}</Text>
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
                  <Text className="text-dark-400">Appointment</Text>
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

      {/* Bottom CTA (the stylist step advances by tapping a stylist) */}
      {step > 0 && (
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
              className={`py-4 rounded-2xl items-center ${canContinue && chosen ? 'bg-primary-500' : 'bg-dark-600'}`}
              onPress={() => setStep(step + 1)}
              disabled={!canContinue || !chosen}
            >
              <Text className="text-white text-lg font-bold">Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}
