import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useAuthStore } from '@/store/authStore'
import { sanityClient, urlFor, formatPrice } from '@/lib/sanity'
import { SERVICES_ACTIVE, PRODUCTS_FEATURED, BOOKINGS_BY_CUSTOMER } from '@/lib/queries'
import type { Service, Product, Booking } from '@cutty/types'
import { TIER_COLORS } from '@/constants'
import { Ionicons } from '@expo/vector-icons'

export default function HomeScreen() {
  const { customer } = useAuthStore()
  const [services, setServices] = useState<Service[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [upcomingBooking, setUpcomingBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData() {
    if (!customer) return
    const [svcs, products, bookings] = await Promise.all([
      sanityClient.fetch(SERVICES_ACTIVE),
      sanityClient.fetch(PRODUCTS_FEATURED),
      sanityClient.fetch(BOOKINGS_BY_CUSTOMER, { customerId: customer._id }),
    ])
    setServices(svcs)
    setFeaturedProducts(products)
    const upcoming = (bookings as Booking[]).find(
      (b) => ['pending', 'confirmed'].includes(b.status)
    )
    setUpcomingBooking(upcoming || null)
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [])

  async function onRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

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
            <Text className="text-white text-2xl font-bold mt-1">{customer?.fullName?.split(' ')[0]}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/wallet')} className="items-end">
            <Text className="text-dark-400 text-xs">Wallet Balance</Text>
            <Text className="text-white text-xl font-bold">{formatPrice(customer?.walletBalance || 0)}</Text>
          </TouchableOpacity>
        </View>

        {/* Loyalty Badge */}
        <View className="flex-row items-center mt-4 bg-dark-700 rounded-xl px-4 py-3 gap-3">
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: tierColor + '33' }}>
            <Text style={{ color: tierColor }}>⭐</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold capitalize">{customer?.tier} Member</Text>
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
              <Ionicons name="scissors" size={20} color="#D4891A" />
            </View>
            <Text className="text-white font-semibold text-base">Book an Appointment</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D4891A" />
        </TouchableOpacity>
      </View>

      {/* Services */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between px-5 mb-3">
          <Text className="text-white font-bold text-lg">Our Services</Text>
          <TouchableOpacity onPress={() => router.push('/booking/new')}>
            <Text className="text-primary-400 text-sm">Book now →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {services.slice(0, 6).map((service) => (
            <TouchableOpacity
              key={service._id}
              className="bg-dark-800 rounded-2xl p-4 w-40"
              onPress={() => router.push('/booking/new')}
            >
              {service.image && (
                <Image source={{ uri: urlFor(service.image).width(200).url() }} className="w-full h-24 rounded-xl mb-3" contentFit="cover" />
              )}
              <Text className="text-white font-semibold text-sm" numberOfLines={2}>{service.name}</Text>
              <Text className="text-primary-400 text-sm font-bold mt-1">{formatPrice(service.price)}</Text>
              <Text className="text-dark-400 text-xs">{service.duration} min</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-white font-bold text-lg">Shop Products</Text>
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
                  <Image source={{ uri: urlFor(product.images[0]).width(200).url() }} className="w-full h-32" contentFit="cover" />
                )}
                <View className="p-3">
                  <Text className="text-white text-sm font-medium" numberOfLines={2}>{product.name}</Text>
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
