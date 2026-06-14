import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { writeClient, formatPrice } from '@/lib/sanity'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { generateOrderNumber } from '@/lib/auth'
import { Ionicons } from '@expo/vector-icons'

const schema = z.object({
  fullName: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  phone: z.string().min(10),
})
type FormData = z.infer<typeof schema>

type PayMethod = 'wallet' | 'card' | 'transfer'

export default function CheckoutScreen() {
  const [payMethod, setPayMethod] = useState<PayMethod>('wallet')
  const [submitting, setSubmitting] = useState(false)
  const { items, subtotal, discount, total, totalPoints, discountCode, clearCart } = useCartStore()
  const { customer, updateCustomer } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: customer?.fullName, phone: customer?.phone },
  })

  async function placeOrder(address: FormData) {
    if (!customer) return
    if (payMethod === 'wallet' && customer.walletBalance < total()) {
      Alert.alert('Insufficient Balance', `Your wallet balance is ${formatPrice(customer.walletBalance)}. Please top up.`, [
        { text: 'Top Up', onPress: () => router.push('/wallet') },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }

    setSubmitting(true)
    try {
      const orderNumber = await generateOrderNumber()
      const pointsEarned = totalPoints()

      const order = await writeClient.create({
        _type: 'order',
        orderNumber,
        customer: { _type: 'reference', _ref: customer._id },
        items: items.map((i) => ({
          _key: i.product._id,
          product: { _type: 'reference', _ref: i.product._id },
          quantity: i.quantity,
          priceAtOrder: i.product.price,
          productName: i.product.name,
        })),
        subtotal: subtotal(),
        discountAmount: discount(),
        shippingFee: 0,
        totalAmount: total(),
        pointsEarned,
        paymentMethod: payMethod,
        status: 'paid',
        shippingAddress: address,
        ...(discountCode ? { discountCode: { _type: 'reference', _ref: discountCode._id } } : {}),
        createdAt: new Date().toISOString(),
      })

      if (payMethod === 'wallet') {
        const newBalance = customer.walletBalance - total()
        await writeClient.patch(customer._id).set({ walletBalance: newBalance }).commit()
        await writeClient.create({
          _type: 'walletTransaction',
          customer: { _type: 'reference', _ref: customer._id },
          type: 'debit', category: 'order_payment',
          amount: total(), balanceAfter: newBalance,
          description: `Order #${orderNumber}`,
          referenceId: order._id, status: 'completed',
          createdAt: new Date().toISOString(),
        })
        updateCustomer({ walletBalance: newBalance })
      }

      const newPoints = customer.loyaltyPoints + pointsEarned
      await writeClient.patch(customer._id).set({ loyaltyPoints: newPoints }).commit()
      await writeClient.create({
        _type: 'loyaltyTransaction',
        customer: { _type: 'reference', _ref: customer._id },
        type: 'earn', points: pointsEarned, balanceAfter: newPoints,
        description: `Points from Order #${orderNumber}`, source: 'order',
        referenceId: order._id, createdAt: new Date().toISOString(),
      })
      updateCustomer({ loyaltyPoints: newPoints })

      clearCart()
      Alert.alert('Order Placed! 🎉', `Order #${orderNumber} placed successfully.`, [
        { text: 'View Orders', onPress: () => router.replace('/orders') },
      ])
    } catch {
      Alert.alert('Error', 'Failed to place order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold">Checkout</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Shipping Address */}
        <View className="bg-dark-800 rounded-2xl p-5 gap-4">
          <Text className="text-white font-bold text-lg">Delivery Address</Text>
          {[
            { name: 'fullName' as const, label: 'Full Name', placeholder: 'Recipient name' },
            { name: 'address' as const, label: 'Street Address', placeholder: '12 Lagos Road' },
            { name: 'city' as const, label: 'City', placeholder: 'Lagos' },
            { name: 'state' as const, label: 'State', placeholder: 'Lagos State' },
            { name: 'phone' as const, label: 'Phone', placeholder: '+234 800 000 0000', keyboard: 'phone-pad' },
          ].map(({ name, label, placeholder, keyboard }) => (
            <Controller key={name} control={control} name={name} render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-1">{label}</Text>
                <TextInput
                  className="bg-dark-700 text-white px-4 py-3 rounded-xl border border-dark-600"
                  placeholder={placeholder} placeholderTextColor="#686868"
                  keyboardType={keyboard as any} value={value} onChangeText={onChange}
                />
                {errors[name] && <Text className="text-red-400 text-xs mt-1">{errors[name]?.message}</Text>}
              </View>
            )} />
          ))}
        </View>

        {/* Payment Method */}
        <View className="bg-dark-800 rounded-2xl p-5 gap-3">
          <Text className="text-white font-bold text-lg">Payment Method</Text>
          {[
            { id: 'wallet' as PayMethod, label: 'Wallet', icon: 'wallet', sub: `Balance: ${formatPrice(customer?.walletBalance || 0)}` },
            { id: 'card' as PayMethod, label: 'Card Payment', icon: 'card', sub: 'Pay with Paystack' },
            { id: 'transfer' as PayMethod, label: 'Bank Transfer', icon: 'swap-horizontal', sub: 'Manual transfer' },
          ].map(({ id, label, icon, sub }) => (
            <TouchableOpacity
              key={id}
              className={`flex-row items-center gap-4 p-4 rounded-xl border ${payMethod === id ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600'}`}
              onPress={() => setPayMethod(id)}
            >
              <Ionicons name={icon as any} size={24} color={payMethod === id ? '#D4891A' : '#888'} />
              <View className="flex-1">
                <Text className={`font-medium ${payMethod === id ? 'text-primary-400' : 'text-white'}`}>{label}</Text>
                <Text className="text-dark-400 text-xs">{sub}</Text>
              </View>
              <View className={`w-5 h-5 rounded-full border-2 ${payMethod === id ? 'bg-primary-500 border-primary-500' : 'border-dark-400'}`} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Order Summary */}
        <View className="bg-dark-800 rounded-2xl p-4 gap-3">
          <Text className="text-white font-bold">Order Summary</Text>
          {items.map((i) => (
            <View key={i.product._id} className="flex-row justify-between">
              <Text className="text-dark-400" numberOfLines={1} style={{ flex: 1 }}>{i.product.name} ×{i.quantity}</Text>
              <Text className="text-white ml-4">{formatPrice(i.product.price * i.quantity)}</Text>
            </View>
          ))}
          {discount() > 0 && (
            <View className="flex-row justify-between">
              <Text className="text-green-400">Discount</Text>
              <Text className="text-green-400">-{formatPrice(discount())}</Text>
            </View>
          )}
          <View className="flex-row justify-between border-t border-dark-700 pt-3">
            <Text className="text-white font-bold">Total</Text>
            <Text className="text-primary-400 font-bold">{formatPrice(total())}</Text>
          </View>
          <Text className="text-primary-400 text-xs text-right">+{totalPoints()} loyalty points</Text>
        </View>
      </ScrollView>

      <View className="px-5 py-4 bg-dark-800 border-t border-dark-700">
        <TouchableOpacity
          className="bg-primary-500 py-4 rounded-2xl items-center"
          onPress={handleSubmit(placeOrder)}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="white" /> : (
            <Text className="text-white text-lg font-bold">Place Order — {formatPrice(total())}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
