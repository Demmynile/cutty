import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { TRY_ON_STYLES, WEEKDAYS, type ConversationSummary } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { imageUri } from '@/lib/sanity'
import { useStylist } from '@/lib/data'
import { getStyleImage } from '@/lib/styleImages'
import { useFormatPrice } from '@/lib/currency'
import { Card, Loading, PrimaryButton, ScreenHeader, SecondaryButton, SectionTitle } from '@/components/ui'
import { StylistAvatar } from '@/components/StylistAvatar'
import { FEATURES } from '@/lib/features'
import { openDirections } from '@/lib/location'

const KIND_LABEL = { barber: 'Barber', braider: 'Braider', both: 'Barber & braider' } as const

export default function StylistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const formatPrice = useFormatPrice()
  const { data: s, error } = useStylist(id)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (error) Alert.alert('Stylist', errorMessage(error), [{ text: 'OK', onPress: () => router.back() }])
  }, [error])

  async function message() {
    if (!s) return
    setOpening(true)
    try {
      const convo = await api<ConversationSummary>('POST', '/api/v1/conversations', { stylistId: s._id })
      router.push(`/chat/${convo._id}?name=${encodeURIComponent(s.name)}`)
    } catch (err) {
      Alert.alert('Message', errorMessage(err))
    } finally {
      setOpening(false)
    }
  }

  if (!s) return <Loading />

  const presetStyles = s.styles.map((id) => TRY_ON_STYLES.find((t) => t.id === id)).filter(Boolean) as typeof TRY_ON_STYLES[number][]
  const customStyles = s.styles.filter((id) => !TRY_ON_STYLES.some((t) => t.id === id))
  const section = s.kind === 'braider' ? 'female' : 'male'

  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader title={s.name} subtitle={KIND_LABEL[s.kind]} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 120 }}>
        <View className="flex-row items-center gap-4">
          <StylistAvatar s={s} size={84} />
          <View className="flex-1">
            <Text className="text-fg text-xl font-bold">{s.name}</Text>
            <Text className="text-dark-400 text-sm mt-1">
              {s.rating ? `★ ${s.rating.toFixed(1)} (${s.totalReviews ?? 0})` : 'New on Cutty'}{s.yearsExperience ? ` · ${s.yearsExperience} years` : ''}
            </Text>
            {FEATURES.shop && s.hasShop && <Text className="text-primary-400 text-xs mt-1">Shop: {s.shopName}</Text>}
          </View>
        </View>

        {s.bio && <Text className="text-dark-200 leading-6">{s.bio}</Text>}

        {s.location && (
          <TouchableOpacity onPress={() => openDirections(s.location!, s.name)} className="bg-dark-800 rounded-2xl p-4 flex-row items-center gap-3" accessibilityRole="button">
            <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center">
              <Ionicons name="location" size={20} color="#D4891A" />
            </View>
            <View className="flex-1">
              <Text className="text-fg font-semibold">{s.location.area ?? 'Work location'}</Text>
              {s.location.address && <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>{s.location.address}</Text>}
            </View>
            <Text className="text-primary-400 text-sm font-semibold">Directions</Text>
          </TouchableOpacity>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1"><SecondaryButton label={opening ? 'Opening…' : 'Message'} icon="chatbubble-ellipses-outline" tone="gold" onPress={message} /></View>
          <View className="flex-1"><SecondaryButton label="Try a style" icon="color-wand-outline" onPress={() => router.push('/ai/tryon')} /></View>
        </View>

        {s.skills.length > 0 && (
          <View>
            <SectionTitle title="Skills" />
            <View className="flex-row flex-wrap gap-2">
              {s.skills.map((k) => <View key={k} className="bg-dark-800 border border-dark-700 px-3 py-1.5 rounded-full"><Text className="text-dark-200 text-sm">{k}</Text></View>)}
            </View>
          </View>
        )}

        {s.styles.length > 0 && (
          <View>
            <SectionTitle title="Styles" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {presetStyles.map((st) => {
                const img = getStyleImage(st.id, st.gender === 'female' ? 'female' : st.gender === 'male' ? 'male' : section)
                return (
                  <TouchableOpacity key={st.id} onPress={() => router.push(`/ai/tryon?styleId=${st.id}`)} className="w-28" accessibilityLabel={`Try on ${st.label}`}>
                    {img ? <Image source={img} style={{ width: 112, height: 112, borderRadius: 14 }} contentFit="cover" /> : <View className="w-28 h-28 rounded-2xl bg-dark-800" />}
                    <Text className="text-fg text-xs font-medium mt-1.5" numberOfLines={1}>{st.label}</Text>
                    <Text className="text-primary-400 text-[11px]">Try it on</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            {customStyles.length > 0 && <Text className="text-dark-300 text-sm mt-3">Also: {customStyles.join(', ')}</Text>}
          </View>
        )}

        <View>
          <SectionTitle title="Appointment" />
          {s.bookingPrice == null ? (
            <Card><Text className="text-dark-400 text-center">{s.name.split(' ')[0]} hasn't set a price yet. Message them to ask.</Text></Card>
          ) : (
            <Card className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-fg font-semibold">Any style they offer</Text>
                <Text className="text-dark-400 text-xs mt-0.5">{s.bookingDuration ?? 60} min · pick your style when you book</Text>
              </View>
              <Text className="text-primary-400 font-bold">{formatPrice(s.bookingPrice)}</Text>
            </Card>
          )}
        </View>

        <View>
          <SectionTitle title="Hours" />
          <Card>
            {WEEKDAYS.map((d) => {
              const w = s.weeklyAvailability.filter((x) => x.day === d)
              return (
                <View key={d} className="flex-row justify-between py-1.5">
                  <Text className="text-dark-300 capitalize">{d}</Text>
                  <Text className={w.length ? 'text-fg' : 'text-dark-500'}>{w.length ? w.map((x) => `${x.start}–${x.end}`).join(', ') : 'Closed'}</Text>
                </View>
              )
            })}
          </Card>
        </View>

        {FEATURES.shop && (s.products ?? []).length > 0 && (
          <View>
            <SectionTitle title={`From ${s.shopName ?? 'their shop'}`} />
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {s.products!.map((p) => (
                <TouchableOpacity key={p._id} onPress={() => router.push(`/product/${p.slug.current}`)} className="bg-dark-800 rounded-2xl overflow-hidden" style={{ width: '48%' }}>
                  {p.images?.[0] ? <Image source={{ uri: imageUri(p.images[0], 360, 240) }} style={{ width: '100%', height: 120 }} contentFit="cover" /> : <View className="h-28 bg-dark-700 items-center justify-center"><Ionicons name="image-outline" size={24} color="#686868" /></View>}
                  <View className="p-3">
                    <Text className="text-fg text-sm font-medium" numberOfLines={2}>{p.name}</Text>
                    <Text className="text-primary-400 font-bold mt-1">{formatPrice(p.price)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {s.bookingPrice != null && s.barberId && (
        <View className="absolute left-0 right-0 bottom-0 px-5 pt-4 pb-8 bg-dark-800 border-t border-dark-700">
          <PrimaryButton label={`Book ${s.name.split(' ')[0]}`} icon="calendar" onPress={() => router.push(`/booking/new?stylistId=${s._id}`)} />
        </View>
      )}
    </View>
  )
}
