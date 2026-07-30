import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { sanityClient, urlFor, formatPrice } from '@/lib/sanity'
import { useAuthStore } from '@/store/authStore'
import { ORDERS_BY_CUSTOMER } from '@/lib/queries'
import type { Order } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', paid: '#3B82F6', processing: '#8B5CF6',
  shipped: '#06B6D4', delivered: '#22C55E', cancelled: '#EF4444', refunded: '#6B7280',
}

export default function OrdersScreen() {
  const { customer } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchOrders() {
    if (!customer) return
    const data = await sanityClient.fetch(ORDERS_BY_CUSTOMER, { customerId: customer._id })
    setOrders(data)
  }

  useEffect(() => { fetchOrders().finally(() => setLoading(false)) }, [])

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold">My Orders</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bag-outline" size={64} color="#484848" />
          <Text className="text-white text-xl font-bold mt-4">No orders yet</Text>
          <TouchableOpacity className="bg-primary-500 mt-6 px-8 py-3 rounded-xl" onPress={() => router.push('/(tabs)/shop')}>
            <Text className="text-white font-semibold">Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false) }} tintColor="#D4891A" />}
        >
          {orders.map((order) => (
            <View key={order._id} className="bg-dark-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-bold">Order #{order.orderNumber}</Text>
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: (STATUS_COLOR[order.status] || '#888') + '33' }}>
                  <Text className="text-xs font-medium capitalize" style={{ color: STATUS_COLOR[order.status] || '#888' }}>{order.status}</Text>
                </View>
              </View>
              <View className="flex-row gap-2 mb-3">
                {order.items?.slice(0, 3).map((item, i) => (
                  <View key={i} className="w-12 h-12 bg-dark-700 rounded-lg overflow-hidden">
                    {item.product?.images?.[0] ? (
                      <Image source={{ uri: urlFor(item.product.images[0]).width(96).url() }} style={{ width: 48, height: 48 }} contentFit="cover" />
                    ) : <View className="w-12 h-12 items-center justify-center"><Ionicons name="image-outline" size={16} color="#484848" /></View>}
                  </View>
                ))}
                {(order.items?.length || 0) > 3 && (
                  <View className="w-12 h-12 bg-dark-700 rounded-lg items-center justify-center">
                    <Text className="text-dark-400 text-sm">+{order.items.length - 3}</Text>
                  </View>
                )}
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-dark-400 text-sm">{new Date(order.createdAt).toLocaleDateString()}</Text>
                <Text className="text-primary-400 font-bold">{formatPrice(order.totalAmount)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
