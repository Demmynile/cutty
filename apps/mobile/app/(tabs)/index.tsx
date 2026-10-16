import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useAuthStore } from '@/store/authStore'
import { imageUri } from '@/lib/sanity'
import { useBookings, useFeaturedProducts, useNearbyStylists, usePullToRefresh, useRecommendations } from '@/lib/data'
import { etaMinutes, formatDistance, useMyLocation } from '@/lib/location'
import { StylistAvatar } from '@/components/StylistAvatar'
import { TIER_COLORS } from '@/constants'
import { Ionicons } from '@expo/vector-icons'
import { useFormatPrice } from '@/lib/currency'
import { FEATURES } from '@/lib/features'

export default function HomeScreen() {
  const formatPrice = useFormatPrice()
  const { customer } = useAuthStore()
  // Only reads a position the customer already allowed; the map asks for it.
  const { position } = useMyLocation()
  const nearbyQ = useNearbyStylists(position)
  const productsQ = useFeaturedProducts(FEATURES.shop)
  const bookingsQ = useBookings()
  // Personal picks from the latest Cutty AI search; never blocks the rest of Home.
  const { data: recs, refetch: refetchRecs } = useRecommendations()
  const { refreshing, onRefresh } = usePullToRefresh(nearbyQ.refetch, productsQ.refetch, bookingsQ.refetch, refetchRecs)

  const nearby = (nearbyQ.data ?? []).filter((s) => s.distanceKm !== undefined).slice(0, 8)
  const featuredProducts = FEATURES.shop ? productsQ.data ?? [] : []
  const upcomingBooking = bookingsQ.data?.find((b) => ['pending', 'confirmed'].includes(b.status)) ?? null
  const loading = (FEATURES.shop && productsQ.isLoading) || bookingsQ.isLoading

  if (loading) {
    return (
      <View className="flex-1 bg-dark-900 items-center justify-center">
        <ActivityIndicator color="#D4891A" size="large" />
      </View>
    )
  }

  const tierColor = TIER_COLORS[customer?.tier || 'bronze']
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <ScrollView
      className="flex-1 bg-dark-900"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4891A" />}
    >
      {/* Header */}
      <View className="px-5 pt-14 pb-6 bg-dark-800">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-dark-400 text-sm">{greeting} 👋</Text>
            <Text className="text-fg text-2xl font-bold mt-1">{customer?.fullName?.split(' ')[0]}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => router.push('/messages')} accessibilityLabel="Messages" hitSlop={8}>
              <Ionicons name="chatbubbles-outline" size={24} className="text-fg" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/wallet')} className="items-end">
              <Text className="text-dark-400 text-xs">Wallet Balance</Text>
              <Text className="text-fg text-xl font-bold">{formatPrice(customer?.walletBalance || 0)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Global search: opens the map of stylists near you */}
        <TouchableOpacity
          onPress={() => router.push('/explore?focus=1')}
          className="flex-row items-center mt-5 bg-dark-900 border border-dark-700 rounded-full pl-4 pr-1.5 py-1.5 gap-3"
          accessibilityRole="search"
          accessibilityLabel="Search stylists near you"
        >
          <Ionicons name="search" size={18} color="#D4891A" />
          <Text className="text-dark-400 flex-1 text-[15px]">Find a barber or stylist near you</Text>
          <TouchableOpacity
            onPress={() => router.push('/explore')}
            className="bg-primary-500 rounded-full px-3.5 py-2 flex-row items-center gap-1.5"
            accessibilityLabel="Open map"
          >
            <Ionicons name="map" size={14} color="#111111" />
            <Text className="text-xs font-bold" style={{ color: '#111111' }}>Map</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Loyalty Badge */}
        <View className="flex-row items-center mt-4 bg-dark-700 rounded-xl px-4 py-3 gap-3">
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: tierColor + '33' }}>
            <Text style={{ color: tierColor }}>⭐</Text>
          </View>
          <View className="flex-1">
            <Text className="text-fg font-semibold capitalize">{customer?.tier} Member</Text>
            <Text className="text-dark-400 text-xs">{customer?.loyaltyPoints} points available</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/loyalty')}>
            <Text className="text-primary-400 text-sm font-medium">View →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Upcoming Booking */}
      {upcomingBooking && (
        <View className="mx-5 mt-5">
          <Text className="text-dark-300 text-sm font-medium mb-3">UPCOMING APPOINTMENT</Text>
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl p-4"
            onPress={() => router.push(`/booking/${upcomingBooking._id}`)}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white font-bold text-lg">{upcomingBooking.bookingDate}</Text>
                <Text className="text-primary-200">{upcomingBooking.startTime} with {upcomingBooking.barber?.name}</Text>
              </View>
              <View className="bg-white/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs capitalize">{upcomingBooking.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Book */}
      <View className="mx-5 mt-6">
        <TouchableOpacity
          className="bg-dark-700 border border-primary-500 rounded-2xl p-4 flex-row items-center justify-between"
          onPress={() => router.push('/booking/new')}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center">
              <Ionicons name="cut" size={20} color="#D4891A" />
            </View>
            <Text className="text-fg font-semibold text-base">Book an Appointment</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D4891A" />
        </TouchableOpacity>
      </View>

      {/* Cutty AI search */}
      <View className="mx-5 mt-4">
        <TouchableOpacity
          onPress={() => router.push('/ai/search')}
          className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3.5 flex-row items-center gap-3"
          accessibilityRole="search"
        >
          <Ionicons name="sparkles" size={18} color="#F1A91F" />
          <Text className="text-dark-400 flex-1">Ask Cutty AI: “braids this weekend under ₦30k”</Text>
        </TouchableOpacity>
      </View>

      {/* Recommended for you / top stylists */}
      {recs && recs.stylists.length > 0 && (
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-fg font-bold text-lg">{recs.personalized ? 'Recommended for you' : 'Top stylists'}</Text>
            <TouchableOpacity onPress={() => router.push('/stylists')}>
              <Text className="text-primary-400 text-sm">All stylists →</Text>
            </TouchableOpacity>
          </View>
          {recs.personalized && <Text className="text-dark-400 text-xs px-5 -mt-2 mb-3" numberOfLines={1}>Based on “{recs.query}”</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {recs.stylists.map(({ stylist, reason }) => (
              <TouchableOpacity key={stylist._id} onPress={() => router.push(`/stylist/${stylist._id}`)} className="bg-dark-800 rounded-2xl p-4 w-56">
                <View className="flex-row items-center gap-3">
                  <StylistAvatar s={stylist} size={44} />
                  <View className="flex-1">
                    <Text className="text-fg font-semibold" numberOfLines={1}>{stylist.name}</Text>
                    <Text className="text-dark-400 text-xs">{stylist.rating ? `★ ${stylist.rating.toFixed(1)}` : 'New'}</Text>
                  </View>
                </View>
                <Text className="text-dark-300 text-xs mt-3" numberOfLines={3}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Near you */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between px-5 mb-3">
          <Text className="text-fg font-bold text-lg">Near you</Text>
          <TouchableOpacity onPress={() => router.push('/explore')}>
            <Text className="text-primary-400 text-sm">See map →</Text>
          </TouchableOpacity>
        </View>
        {nearby.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {nearby.map((s, i) => (
              <TouchableOpacity key={s._id} onPress={() => router.push(`/stylist/${s._id}`)} className="bg-dark-800 rounded-2xl p-4 w-44">
                <StylistAvatar s={s} size={48} />
                <Text className="text-fg font-semibold mt-3" numberOfLines={1}>{s.name}</Text>
                <Text className="text-dark-400 text-xs mt-0.5" numberOfLines={1}>{s.location?.area ?? (s.rating ? `★ ${s.rating.toFixed(1)}` : 'New')}</Text>
                <View className="flex-row items-center gap-1 mt-2">
                  <Ionicons name="navigate" size={12} color="#D4891A" />
                  <Text className="text-primary-400 text-xs font-semibold">
                    {formatDistance(s.distanceKm!)} · ~{etaMinutes(s.distanceKm!)} min{i === 0 ? ' · Nearest' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity onPress={() => router.push('/explore')} className="mx-5 bg-dark-800 rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center">
              <Ionicons name="location" size={20} color="#D4891A" />
            </View>
            <View className="flex-1">
              <Text className="text-fg font-semibold">{position ? 'No stylists close by yet' : 'See stylists around you'}</Text>
              <Text className="text-dark-400 text-xs mt-0.5">{position ? 'Open the map to search a wider area.' : 'Turn on location to find the nearest chair.'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D4891A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-fg font-bold text-lg">Shop Products</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}>
              <Text className="text-primary-400 text-sm">See all →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {featuredProducts.map((product) => (
              <TouchableOpacity
                key={product._id}
                className="bg-dark-800 rounded-2xl overflow-hidden w-44"
                onPress={() => router.push(`/product/${product.slug.current}`)}
              >
                {product.images?.[0] && (
                  <Image source={{ uri: imageUri(product.images[0], 352, 256) }} className="w-full h-32" contentFit="cover" />
                )}
                <View className="p-3">
                  <Text className="text-fg text-sm font-medium" numberOfLines={2}>{product.name}</Text>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-primary-400 font-bold">{formatPrice(product.price)}</Text>
                    {product.compareAtPrice && (
                      <Text className="text-dark-400 text-xs line-through">{formatPrice(product.compareAtPrice)}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  )
}
