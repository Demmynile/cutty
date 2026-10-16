import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard, Platform, useWindowDimensions, ActivityIndicator } from 'react-native'
import MapView, { Marker, type Region } from 'react-native-maps'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { StylistLocation, StylistPublic } from '@cutty/types'
import { useNearbyStylists, useStylists } from '@/lib/data'
import { DEFAULT_CENTER, etaMinutes, formatDistance, openDirections, useMyLocation } from '@/lib/location'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/mapStyle'
import { useTheme } from '@/lib/theme'
import { StylistAvatar } from '@/components/StylistAvatar'
import { useFormatPrice } from '@/lib/currency'

const KIND_LABEL = { barber: 'Barber', braider: 'Braider', both: 'Barber & braider' } as const
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'barber', label: 'Barbers' },
  { id: 'braider', label: 'Braiders' },
] as const
type Filter = (typeof FILTERS)[number]['id']
type Located = StylistPublic & { location: StylistLocation }

const GOLD = '#D4891A'
const ON_GOLD = '#111111'
const CARD_GAP = 12
// Neighbourhood-level zoom, about 6 km across.
const ZOOM = { latitudeDelta: 0.055, longitudeDelta: 0.055 }

// Customer map search: "find the nearest chair", Uber-style. The map shows
// every stylist with a work location; the carousel below is sorted nearest
// first, and swiping it or tapping a pin keeps the two in sync.
export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string; focus?: string }>()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { scheme, colors } = useTheme()
  const { position, permission, locating, refresh } = useMyLocation({ prompt: true })

  const nearbyQ = useNearbyStylists(position)
  const allQ = useStylists()
  const source = nearbyQ.data ?? allQ.data
  const loading = !source && (allQ.isLoading || nearbyQ.isLoading)

  const [query, setQuery] = useState(params.q ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const [searching, setSearching] = useState(params.focus === '1')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mapRef = useRef<MapView>(null)
  const listRef = useRef<FlatList<Located>>(null)
  const centredOnUser = useRef(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (source ?? []).filter(
      (s) =>
        (filter === 'all' || s.kind === filter || s.kind === 'both') &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.location?.area?.toLowerCase().includes(q) ||
          [...s.skills, ...s.styles].some((t) => t.toLowerCase().includes(q))),
    )
  }, [source, query, filter])
  const located = useMemo(() => results.filter((s): s is Located => !!s.location), [results])
  const nearest = position ? located[0] : undefined

  const cardW = width - 56
  const selected = located.find((s) => s._id === selectedId) ?? located[0]

  // First fix: centre on the customer once, then let them pan freely.
  useEffect(() => {
    if (!position || centredOnUser.current) return
    centredOnUser.current = true
    mapRef.current?.animateToRegion({ latitude: position.lat, longitude: position.lng, ...ZOOM }, 600)
  }, [position])

  // New search or filter: frame the results so nothing is off-screen.
  useEffect(() => {
    if (!located.length || searching) return
    setSelectedId(located[0]._id)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
    if (!query && filter === 'all') return
    const points = located.slice(0, 8).map((s) => ({ latitude: s.location.lat, longitude: s.location.lng }))
    if (position) points.push({ latitude: position.lat, longitude: position.lng })
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: insets.top + 140, right: 60, bottom: 260, left: 60 },
      animated: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter, searching, located.length])

  function focusStylist(s: Located, scroll: boolean) {
    setSelectedId(s._id)
    mapRef.current?.animateToRegion({ latitude: s.location.lat - 0.006, longitude: s.location.lng, ...ZOOM }, 450)
    if (scroll) {
      const index = located.findIndex((x) => x._id === s._id)
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true })
    }
  }

  function recentre() {
    if (!position) return refresh()
    mapRef.current?.animateToRegion({ latitude: position.lat, longitude: position.lng, ...ZOOM }, 450)
  }

  function closeSearch() {
    Keyboard.dismiss()
    setSearching(false)
  }

  const start = position ?? DEFAULT_CENTER
  const initialRegion: Region = { latitude: start.lat, longitude: start.lng, ...ZOOM }

  return (
    <View className="flex-1 bg-dark-900">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        userInterfaceStyle={scheme}
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        tintColor={GOLD}
        mapPadding={{ top: insets.top + 120, right: 0, bottom: 230, left: 0 }}
        onPress={closeSearch}
      >
        {located.map((s) => (
          <StylistPin key={s._id} s={s} selected={s._id === selected?._id} onPress={() => focusStylist(s, true)} />
        ))}
      </MapView>

      {/* Search bar + filters */}
      <View className="absolute left-0 right-0 px-4" style={{ top: insets.top + 8 }}>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => (searching ? closeSearch() : router.back())}
            className="w-12 h-12 rounded-full bg-dark-800 border border-dark-700 items-center justify-center"
            style={SHADOW}
            accessibilityRole="button"
            accessibilityLabel={searching ? 'Close search' : 'Back'}
          >
            <Ionicons name="arrow-back" size={22} className="text-fg" />
          </TouchableOpacity>
          <View className="flex-1 h-12 flex-row items-center bg-dark-800 border border-dark-700 rounded-full pl-4 pr-2 gap-2" style={SHADOW}>
            <Ionicons name="search" size={18} color={GOLD} />
            <TextInput
              className="flex-1 text-fg text-[15px]"
              placeholder="Search stylists, styles or area"
              placeholderTextColor={colors['dark-500']}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearching(true)}
              onSubmitEditing={closeSearch}
              autoFocus={params.focus === '1'}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search stylists near you"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors['dark-500']} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push(query.trim() ? `/ai/search?q=${encodeURIComponent(query.trim())}` : '/ai/search')}
              className="w-8 h-8 rounded-full bg-primary-500/15 items-center justify-center"
              accessibilityLabel="Ask Cutty AI"
            >
              <Ionicons name="sparkles" size={15} color="#F1A91F" />
            </TouchableOpacity>
          </View>
        </View>
        {!searching && (
          <View className="flex-row gap-2 mt-3">
            {FILTERS.map((f) => {
              const on = filter === f.id
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  className={`px-4 py-2 rounded-full border ${on ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'}`}
                  style={SHADOW}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text className={`text-sm font-semibold ${on ? '' : 'text-dark-200'}`} style={on ? { color: ON_GOLD } : undefined}>{f.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>

      {/* Search results list, over the map while typing */}
      {searching && (
        <View className="absolute left-4 right-4 bg-dark-800 border border-dark-700 rounded-3xl overflow-hidden" style={[SHADOW, { top: insets.top + 68, maxHeight: '60%' }]}>
          <FlatList
            data={results}
            keyExtractor={(s) => s._id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View className="h-px bg-dark-700 ml-[76px]" />}
            ListHeaderComponent={
              <Text className="text-dark-400 text-xs font-semibold tracking-widest px-4 pt-4 pb-2">
                {position ? 'NEAREST FIRST' : 'ALL STYLISTS'}
              </Text>
            }
            ListEmptyComponent={
              <View className="items-center px-6 py-8">
                <Ionicons name="search" size={28} className="text-dark-600" />
                <Text className="text-fg font-semibold mt-3">No stylists match “{query.trim()}”</Text>
                <Text className="text-dark-400 text-sm text-center mt-1">Try a style like “locs” or an area like “Lekki”.</Text>
              </View>
            }
            renderItem={({ item: s }) => (
              <TouchableOpacity
                className="flex-row items-center px-4 py-3 gap-3"
                onPress={() => {
                  closeSearch()
                  if (s.location) focusStylist(s as Located, true)
                  else router.push(`/stylist/${s._id}`)
                }}
              >
                <StylistAvatar s={s} size={48} />
                <View className="flex-1">
                  <Text className="text-fg font-semibold" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>
                    {KIND_LABEL[s.kind]}{s.location?.area ? ` · ${s.location.area}` : ''}
                  </Text>
                </View>
                {s.distanceKm !== undefined ? (
                  <Text className="text-primary-400 text-xs font-semibold">{formatDistance(s.distanceKm)}</Text>
                ) : !s.location ? (
                  <Text className="text-dark-500 text-xs">No map pin</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Bottom: recentre button + stylist carousel */}
      {!searching && (
        <View className="absolute left-0 right-0" style={{ bottom: insets.bottom + 16 }}>
          <View className="flex-row justify-end px-4 mb-3">
            <TouchableOpacity
              onPress={recentre}
              className="w-12 h-12 rounded-full bg-dark-800 border border-dark-700 items-center justify-center"
              style={SHADOW}
              accessibilityLabel="Show my location"
            >
              {locating ? <ActivityIndicator color={GOLD} /> : <Ionicons name={position ? 'locate' : 'navigate-outline'} size={22} color={GOLD} />}
            </TouchableOpacity>
          </View>

          {permission === 'denied' && (
            <TouchableOpacity onPress={refresh} className="mx-4 mb-3 bg-dark-800 border border-primary-500/40 rounded-2xl px-4 py-3 flex-row items-center gap-3" style={SHADOW}>
              <Ionicons name="location" size={18} color={GOLD} />
              <Text className="text-dark-200 text-sm flex-1">Turn on location to sort stylists by distance.</Text>
              <Text className="text-primary-400 text-sm font-semibold">Settings</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View className="mx-4 bg-dark-800 rounded-3xl h-36 items-center justify-center" style={SHADOW}>
              <ActivityIndicator color={GOLD} />
              <Text className="text-dark-400 text-sm mt-2">Finding chairs near you…</Text>
            </View>
          ) : located.length === 0 ? (
            <View className="mx-4 bg-dark-800 border border-dark-700 rounded-3xl p-5 items-center" style={SHADOW}>
              <Ionicons name="map-outline" size={28} className="text-dark-500" />
              <Text className="text-fg font-semibold mt-2">{query || filter !== 'all' ? 'No stylists here yet' : 'No stylists on the map yet'}</Text>
              <TouchableOpacity onPress={() => router.push('/stylists')} className="mt-3">
                <Text className="text-primary-400 font-semibold">Browse all stylists →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={located}
              horizontal
              keyExtractor={(s) => s._id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16, gap: CARD_GAP }}
              getItemLayout={(_, index) => ({ length: cardW + CARD_GAP, offset: (cardW + CARD_GAP) * index, index })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP))
                const s = located[Math.min(Math.max(index, 0), located.length - 1)]
                if (s && s._id !== selected?._id) focusStylist(s, false)
              }}
              renderItem={({ item: s }) => (
                <StylistCard s={s} width={cardW} nearest={s._id === nearest?._id} active={s._id === selected?._id} />
              )}
            />
          )}
        </View>
      )}
    </View>
  )
}

const SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 6 },
})

/** Gold-ringed photo pin; the selected one grows and shows the stylist's name. */
const StylistPin = memo(function StylistPin({ s, selected, onPress }: { s: Located; selected: boolean; onPress: () => void }) {
  // Android snapshots custom markers; keep re-rendering briefly so the photo
  // lands in the snapshot, then stop for smooth panning.
  const [tracks, setTracks] = useState(true)
  useEffect(() => {
    setTracks(true)
    const t = setTimeout(() => setTracks(false), 600)
    return () => clearTimeout(t)
  }, [selected])

  const size = selected ? 48 : 38
  return (
    <Marker
      coordinate={{ latitude: s.location.lat, longitude: s.location.lng }}
      onPress={onPress}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 10 : 1}
      accessibilityLabel={`${s.name}${s.location.area ? `, ${s.location.area}` : ''}`}
    >
      <View className="items-center">
        {selected && (
          <View className="bg-primary-500 rounded-full px-2.5 py-1 mb-1">
            <Text className="text-xs font-bold" style={{ color: ON_GOLD }} numberOfLines={1}>{s.name.split(' ')[0]}</Text>
          </View>
        )}
        <View className="rounded-full items-center justify-center bg-primary-500" style={{ width: size + 6, height: size + 6 }}>
          <StylistAvatar s={s} size={size} />
        </View>
        <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: GOLD, marginTop: -1 }} />
      </View>
    </Marker>
  )
})

function StylistCard({ s, width, nearest, active }: { s: Located; width: number; nearest: boolean; active: boolean }) {
  const formatPrice = useFormatPrice()
  return (
    <View
      className={`bg-dark-800 rounded-3xl p-4 border ${active ? 'border-primary-500/60' : 'border-dark-700'}`}
      style={[SHADOW, { width }]}
    >
      <View className="flex-row items-center gap-3">
        <StylistAvatar s={s} size={56} />
        <View className="flex-1">
          {nearest && (
            <View className="self-start bg-primary-500/15 rounded-full px-2 py-0.5 mb-1">
              <Text className="text-primary-400 text-[10px] font-bold tracking-widest">NEAREST TO YOU</Text>
            </View>
          )}
          <Text className="text-fg font-bold text-base" numberOfLines={1}>{s.name}</Text>
          <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>
            {KIND_LABEL[s.kind]} · {s.rating ? `★ ${s.rating.toFixed(1)}` : 'New'}{s.location.area ? ` · ${s.location.area}` : ''}
          </Text>
        </View>
        {s.distanceKm !== undefined && (
          <View className="items-end">
            <Text className="text-fg font-bold">{formatDistance(s.distanceKm)}</Text>
            <Text className="text-dark-400 text-xs">~{etaMinutes(s.distanceKm)} min</Text>
          </View>
        )}
      </View>
      {s.skills.length > 0 && (
        <Text className="text-dark-300 text-xs mt-3" numberOfLines={1}>{s.skills.slice(0, 4).join(' · ')}</Text>
      )}
      <Text className="text-primary-400 text-sm font-bold mt-2">
        {s.bookingPrice != null ? `${formatPrice(s.bookingPrice)} · ${s.bookingDuration ?? 60} min` : 'Price on request'}
      </Text>
      <View className="flex-row gap-2 mt-4">
        <TouchableOpacity
          onPress={() => router.push(`/stylist/${s._id}`)}
          className="flex-1 bg-primary-500 rounded-2xl py-3 items-center flex-row justify-center gap-2"
          accessibilityRole="button"
        >
          <Ionicons name="cut" size={16} color={ON_GOLD} />
          <Text className="font-bold" style={{ color: ON_GOLD }}>View & book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openDirections(s.location, s.name)}
          className="w-12 bg-dark-700 border border-dark-600 rounded-2xl items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${s.name}`}
        >
          <Ionicons name="navigate" size={18} color={GOLD} />
        </TouchableOpacity>
      </View>
    </View>
  )
}
