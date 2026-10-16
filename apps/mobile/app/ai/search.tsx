import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { TRY_ON_STYLES, type AISearchResult } from '@cutty/types'
import { errorMessage } from '@/lib/api'
import { invalidate, keys, useRecommendations } from '@/lib/data'
import { aiSearch } from '@/lib/ai'
import { imageUri } from '@/lib/sanity'
import { getStyleImage } from '@/lib/styleImages'
import { useFormatPrice } from '@/lib/currency'
import { Card, SectionTitle } from '@/components/ui'
import { StylistAvatar } from '@/components/StylistAvatar'
import { FEATURES } from '@/lib/features'

const EXAMPLES = [
  'Knotless braids this Saturday under ₦30k',
  'A barber who does clean skin fades after work',
  'Something for dry, curly hair',
  'Low-maintenance protective style for a holiday',
]

// Plain-language search across stylists, their styles and prices, and shop products.
// The latest search also becomes "Recommended for you" on Home.
export default function AISearchScreen() {
  const formatPrice = useFormatPrice()
  // ?q= hands over a search typed elsewhere (e.g. the map) and runs it.
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [result, setResult] = useState<AISearchResult | null>(null)
  const [searching, setSearching] = useState(false)

  const { data: recs } = useRecommendations()
  useEffect(() => {
    if (recs?.personalized && !initialQuery) setResult((current) => current ?? recs)
  }, [recs, initialQuery])

  useEffect(() => {
    if (initialQuery) run(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(q = query) {
    const text = q.trim()
    if (text.length < 2) return
    setQuery(text)
    setSearching(true)
    try {
      setResult(await aiSearch(text))
      invalidate(keys.recommendations) // Home's "Recommended for you" follows the latest search
    } catch (err) {
      Alert.alert('Search', errorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center gap-4 mb-4">
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Close" hitSlop={10}><Ionicons name="close" size={24} className="text-fg" /></TouchableOpacity>
          <View className="flex-1">
            <Text className="text-fg text-lg font-bold">Ask Cutty AI</Text>
            <Text className="text-dark-400 text-xs">Find stylists, styles{FEATURES.shop ? ' and products' : ''} in your own words</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <TextInput
            className="flex-1 bg-dark-700 text-fg px-4 py-3 rounded-2xl border border-dark-600"
            placeholder="What are you looking for?"
            placeholderTextColor="#686868"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => run()}
            returnKeyType="search"
            maxLength={300}
            autoFocus={!result}
          />
          <TouchableOpacity onPress={() => run()} disabled={searching || query.trim().length < 2} className={`w-12 h-12 rounded-full items-center justify-center ${query.trim().length >= 2 ? 'bg-primary-500' : 'bg-dark-700'}`} accessibilityLabel="Search">
            {searching ? <ActivityIndicator color="#111111" /> : <Ionicons name="sparkles" size={20} color={query.trim().length >= 2 ? '#111111' : '#686868'} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!result && !searching && (
          <View className="gap-2">
            <Text className="text-dark-400 text-sm mb-1">Try:</Text>
            {EXAMPLES.map((e) => (
              <TouchableOpacity key={e} onPress={() => run(e)} className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3">
                <Text className="text-dark-200">{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {searching && (
          <View className="items-center py-10 gap-3">
            <ActivityIndicator color="#D4891A" size="large" />
            <Text className="text-dark-400">Looking through stylists{FEATURES.shop ? ' and products' : ''}…</Text>
          </View>
        )}

        {result && !searching && (
          <>
            <Card className="bg-primary-500/10 border border-primary-500/30">
              <Text className="text-dark-400 text-xs mb-1">“{result.query}”</Text>
              <Text className="text-fg leading-6">{result.summary}</Text>
            </Card>

            {result.stylists.length > 0 && (
              <View>
                <SectionTitle title="Stylists for you" />
                <View className="gap-3">
                  {result.stylists.map(({ stylist, reason }) => (
                    <TouchableOpacity key={stylist._id} onPress={() => router.push(`/stylist/${stylist._id}`)} className="bg-dark-800 rounded-2xl p-4 flex-row gap-3 items-center">
                      <StylistAvatar s={stylist} size={52} />
                      <View className="flex-1">
                        <Text className="text-fg font-semibold">{stylist.name}{stylist.rating ? `  ★ ${stylist.rating.toFixed(1)}` : ''}</Text>
                        <Text className="text-dark-300 text-sm mt-1">{reason}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#686868" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {result.styles.length > 0 && (
              <View>
                <SectionTitle title="Looks to try on" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {result.styles.map((id) => {
                    const st = TRY_ON_STYLES.find((t) => t.id === id)
                    if (!st) return null
                    const img = getStyleImage(st.id, st.gender === 'female' ? 'female' : 'male')
                    return (
                      <TouchableOpacity key={id} onPress={() => router.push(`/ai/tryon?styleId=${id}`)} className="w-28">
                        {img ? <Image source={img} style={{ width: 112, height: 112, borderRadius: 14 }} contentFit="cover" /> : <View className="w-28 h-28 rounded-2xl bg-dark-800" />}
                        <Text className="text-fg text-xs font-medium mt-1.5" numberOfLines={1}>{st.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {FEATURES.shop && result.products.length > 0 && (
              <View>
                <SectionTitle title="Products" />
                <View className="gap-3">
                  {result.products.map(({ product, reason }) => (
                    <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product.slug.current}`)} className="bg-dark-800 rounded-2xl p-3 flex-row gap-3 items-center">
                      {product.images?.[0] ? (
                        <Image source={{ uri: imageUri(product.images[0], 128, 128) }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
                      ) : (
                        <View className="w-16 h-16 rounded-xl bg-dark-700 items-center justify-center"><Ionicons name="image-outline" size={20} color="#686868" /></View>
                      )}
                      <View className="flex-1">
                        <Text className="text-fg font-semibold" numberOfLines={1}>{product.name}</Text>
                        <Text className="text-primary-400 font-bold text-sm">{formatPrice(product.price)}</Text>
                        <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={2}>{reason}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {!result.stylists.length && !result.products.length && !result.styles.length && (
              <Text className="text-dark-400 text-center">Nothing matched closely. Try different words, or browse all stylists.</Text>
            )}
            <TouchableOpacity onPress={() => router.push('/stylists')} className="items-center py-2">
              <Text className="text-primary-400">Browse all stylists →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
