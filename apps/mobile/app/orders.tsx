import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import type { Order } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'
import { imageUri } from '@/lib/sanity'
import { useOrders, usePullToRefresh } from '@/lib/data'
import { useFormatPrice } from '@/lib/currency'
import { statusColor } from '@/constants'
import { withShop } from '@/lib/features'

function OrdersScreen() {
  const formatPrice = useFormatPrice()
  const { data: orders = [], isLoading, refetch } = useOrders()
  const { refreshing, onRefresh } = usePullToRefresh(refetch)

  function renderItem({ item: order }: { item: Order }) {
    const color = statusColor(order.status)
    return (
      <View className="bg-dark-800 rounded-2xl p-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-fg font-bold">Order #{order.orderNumber}</Text>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: color + '33' }}>
            <Text className="text-xs font-medium capitalize" style={{ color }}>{order.status}</Text>
          </View>
        </View>
        <View className="flex-row gap-2 mb-3">
          {order.items?.slice(0, 3).map((item, i) => (
            <View key={i} className="w-12 h-12 bg-dark-700 rounded-lg overflow-hidden">
              {item.product?.images?.[0] ? (
                <Image source={{ uri: imageUri(item.product.images[0], 96, 96) }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : <View className="w-12 h-12 items-center justify-center"><Ionicons name="image-outline" size={16} className="text-dark-600" /></View>}
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
    )
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} className="text-fg" /></TouchableOpacity>
        <Text className="text-fg text-xl font-bold">My Orders</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bag-outline" size={64} className="text-dark-600" />
          <Text className="text-fg text-xl font-bold mt-4">No orders yet</Text>
          <TouchableOpacity className="bg-primary-500 mt-6 px-8 py-3 rounded-xl" onPress={() => router.push('/(tabs)/shop')}>
            <Text className="text-white font-semibold">Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          initialNumToRender={8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4891A" />}
        />
      )}
    </View>
  )
}

// Hidden until the shop launches (v2.0).
export default withShop(OrdersScreen)
