import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { urlFor, formatPrice, sanityClient } from '@/lib/sanity'
import { DISCOUNT_CODE_BY_CODE } from '@/lib/queries'
import type { DiscountCode } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'

export default function CartScreen() {
  const { items, removeItem, updateQuantity, subtotal, discount, total, setDiscountCode, discountCode, clearCart } = useCartStore()
  const [codeInput, setCodeInput] = useState('')
  const [validating, setValidating] = useState(false)

  async function applyCode() {
    if (!codeInput.trim()) return
    setValidating(true)
    try {
      const code: DiscountCode = await sanityClient.fetch(DISCOUNT_CODE_BY_CODE, { code: codeInput.trim().toUpperCase() })
      if (!code) { Alert.alert('Invalid', 'Code not found or expired.'); return }
      if (code.applicableTo === 'booking') { Alert.alert('Invalid', 'This code is only valid for bookings.'); return }
      if (code.validUntil && new Date(code.validUntil) < new Date()) { Alert.alert('Expired', 'This code has expired.'); return }
      if (subtotal() < (code.minOrderAmount || 0)) { Alert.alert('Minimum not met', `Minimum order amount is ${formatPrice(code.minOrderAmount)}.`); return }
      setDiscountCode(code)
      Alert.alert('Applied! 🎉', `Code "${code.code}" applied.`)
    } catch {
      Alert.alert('Error', 'Failed to validate code.')
    } finally {
      setValidating(false)
    }
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-dark-900 items-center justify-center px-8">
        <View className="pt-14 absolute top-0 left-5">
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        </View>
        <Ionicons name="bag-outline" size={80} color="#484848" />
        <Text className="text-white text-2xl font-bold mt-4">Your cart is empty</Text>
        <Text className="text-dark-400 text-center mt-2">Add some amazing products to your cart</Text>
        <TouchableOpacity className="bg-primary-500 mt-8 px-10 py-4 rounded-2xl" onPress={() => router.push('/(tabs)/shop')}>
          <Text className="text-white font-bold">Browse Products</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Cart ({items.length})</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearCart }])}>
          <Text className="text-red-400 text-sm">Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 12 }}>
        {/* Items */}
        {items.map((item) => (
          <View key={item.product._id} className="bg-dark-800 rounded-2xl p-4 flex-row gap-4">
            <View className="w-20 h-20 rounded-xl bg-dark-700 overflow-hidden">
              {item.product.images?.[0] ? (
                <Image source={{ uri: urlFor(item.product.images[0]).width(160).url() }} style={{ width: 80, height: 80 }} contentFit="cover" />
              ) : <View className="w-20 h-20 items-center justify-center"><Ionicons name="image-outline" size={24} color="#484848" /></View>}
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium" numberOfLines={2}>{item.product.name}</Text>
              <Text className="text-primary-400 font-bold mt-1">{formatPrice(item.product.price)}</Text>
              <View className="flex-row items-center gap-3 mt-2">
                <TouchableOpacity className="w-7 h-7 bg-dark-600 rounded-full items-center justify-center" onPress={() => updateQuantity(item.product._id, item.quantity - 1)}>
                  <Ionicons name="remove" size={14} color="white" />
                </TouchableOpacity>
                <Text className="text-white font-bold">{item.quantity}</Text>
                <TouchableOpacity className="w-7 h-7 bg-dark-600 rounded-full items-center justify-center" onPress={() => updateQuantity(item.product._id, item.quantity + 1)}>
                  <Ionicons name="add" size={14} color="white" />
                </TouchableOpacity>
                <TouchableOpacity className="ml-auto" onPress={() => removeItem(item.product._id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Discount Code */}
        <View className="bg-dark-800 rounded-2xl p-4">
          <Text className="text-white font-medium mb-3">Discount Code</Text>
          <View className="flex-row gap-3">
            <TextInput
              className="flex-1 bg-dark-700 text-white px-4 py-3 rounded-xl border border-dark-600"
              placeholder="Enter code..."
              placeholderTextColor="#686868"
              autoCapitalize="characters"
              value={codeInput}
              onChangeText={setCodeInput}
            />
            <TouchableOpacity className="bg-primary-500 px-4 rounded-xl items-center justify-center" onPress={applyCode} disabled={validating}>
              {validating ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-medium">Apply</Text>}
            </TouchableOpacity>
          </View>
          {discountCode && (
            <View className="mt-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text className="text-green-400 text-sm">{discountCode.code} applied</Text>
              </View>
              <TouchableOpacity onPress={() => setDiscountCode(null)}>
                <Text className="text-red-400 text-sm">Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Summary */}
        <View className="bg-dark-800 rounded-2xl p-4 gap-3">
          <View className="flex-row justify-between">
            <Text className="text-dark-400">Subtotal</Text>
            <Text className="text-white">{formatPrice(subtotal())}</Text>
          </View>
          {discount() > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-green-400">Discount</Text>
              <Text className="text-green-400">-{formatPrice(discount())}</Text>
            </View>
          )}
          <View className="flex-row justify-between border-t border-dark-700 pt-3">
            <Text className="text-white font-bold text-lg">Total</Text>
            <Text className="text-primary-400 font-bold text-lg">{formatPrice(total())}</Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-5 py-4 bg-dark-800 border-t border-dark-700">
        <TouchableOpacity className="bg-primary-500 py-4 rounded-2xl items-center" onPress={() => router.push('/checkout')}>
          <Text className="text-white text-lg font-bold">Proceed to Checkout — {formatPrice(total())}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
