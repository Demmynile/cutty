import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { PaymentMethodCard } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'

function detectCardBrand(cardNumber: string): PaymentMethodCard['brand'] {
  if (/^5061|^5060|^6500/.test(cardNumber)) return 'verve'
  if (cardNumber.startsWith('4')) return 'visa'
  if (cardNumber.startsWith('5')) return 'mastercard'
  return 'other'
}

const BRAND_ICON: Record<PaymentMethodCard['brand'], keyof typeof Ionicons.glyphMap> = {
  visa: 'card',
  mastercard: 'card',
  verve: 'card',
  other: 'card-outline',
}

function generateKey(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export default function PaymentMethodsScreen() {
  const { customer, updateCustomer } = useAuthStore()
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [holderName, setHolderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')

  const cards = customer?.paymentMethods || []

  async function persist(updated: PaymentMethodCard[]) {
    if (!customer) return
    await api('PUT', '/api/v1/me/payment-methods', { paymentMethods: updated })
    updateCustomer({ paymentMethods: updated })
  }

  async function addCard() {
    const digits = cardNumber.replace(/\s/g, '')
    const [monthStr, yearStr] = expiry.split('/').map((s) => s.trim())
    const month = parseInt(monthStr, 10)
    const year = parseInt(yearStr, 10)

    if (!holderName.trim()) return Alert.alert('Missing Info', 'Enter the cardholder name.')
    if (digits.length < 12) return Alert.alert('Invalid Card', 'Enter a valid card number.')
    if (!month || month < 1 || month > 12 || !year) return Alert.alert('Invalid Expiry', 'Use MM/YY format.')

    setSaving(true)
    try {
      const newCard: PaymentMethodCard = {
        _key: generateKey(),
        brand: detectCardBrand(digits),
        last4: digits.slice(-4),
        expiryMonth: month,
        expiryYear: year < 100 ? 2000 + year : year,
        holderName: holderName.trim(),
        isDefault: cards.length === 0,
      }
      await persist([...cards, newCard])
      setAddModal(false)
      setHolderName('')
      setCardNumber('')
      setExpiry('')
    } catch {
      Alert.alert('Error', 'Failed to save card. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function removeCard(key: string) {
    Alert.alert('Remove Card', 'Remove this saved card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = cards.filter((c) => c._key !== key)
          if (updated.length > 0 && !updated.some((c) => c.isDefault)) {
            updated[0].isDefault = true
          }
          await persist(updated)
        },
      },
    ])
  }

  async function setDefault(key: string) {
    const updated = cards.map((c) => ({ ...c, isDefault: c._key === key }))
    await persist(updated)
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <Text className="text-fg text-xl font-bold">Payment Methods</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 12 }}>
        {cards.length === 0 ? (
          <View className="bg-dark-800 rounded-2xl p-8 items-center">
            <Ionicons name="card-outline" size={48} className="text-dark-600" />
            <Text className="text-dark-400 mt-3">No saved cards yet</Text>
          </View>
        ) : (
          cards.map((card) => (
            <View key={card._key} className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex-row items-center gap-4">
              <View className="w-11 h-11 bg-primary-500/10 rounded-xl items-center justify-center">
                <Ionicons name={BRAND_ICON[card.brand]} size={20} color="#F1A91F" />
              </View>
              <TouchableOpacity className="flex-1" onPress={() => setDefault(card._key)}>
                <Text className="text-fg font-semibold capitalize">
                  {card.brand} •••• {card.last4}
                </Text>
                <Text className="text-dark-400 text-xs mt-0.5">
                  {card.holderName} · Expires {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
                </Text>
                {card.isDefault && (
                  <View className="bg-primary-500/15 px-2 py-0.5 rounded-full self-start mt-1.5">
                    <Text className="text-primary-400 text-xs font-medium">Default</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity className="p-2" onPress={() => removeCard(card._key)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          className="border border-dark-600 rounded-2xl p-4 items-center flex-row justify-center gap-2 mt-2"
          onPress={() => setAddModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#F1A91F" />
          <Text className="text-primary-400 font-semibold">Add New Card</Text>
        </TouchableOpacity>

        <Text className="text-dark-500 text-xs text-center mt-2">
          Card details are stored for reference only and aren't charged automatically — you'll confirm payment at checkout.
        </Text>
      </ScrollView>

      <Modal visible={addModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-dark-800 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-fg text-xl font-bold">Add Card</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={24} className="text-dark-400" />
              </TouchableOpacity>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-dark-300 text-sm mb-2">Cardholder Name</Text>
                <TextInput
                  className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600"
                  placeholder="John Doe"
                  placeholderTextColor="#686868"
                  value={holderName}
                  onChangeText={setHolderName}
                />
              </View>
              <View>
                <Text className="text-dark-300 text-sm mb-2">Card Number</Text>
                <TextInput
                  className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600"
                  placeholder="4242 4242 4242 4242"
                  placeholderTextColor="#686868"
                  keyboardType="number-pad"
                  maxLength={19}
                  value={cardNumber}
                  onChangeText={setCardNumber}
                />
              </View>
              <View>
                <Text className="text-dark-300 text-sm mb-2">Expiry (MM/YY)</Text>
                <TextInput
                  className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600"
                  placeholder="12/28"
                  placeholderTextColor="#686868"
                  keyboardType="number-pad"
                  maxLength={5}
                  value={expiry}
                  onChangeText={setExpiry}
                />
              </View>

              <TouchableOpacity
                className="bg-primary-500 py-4 rounded-2xl items-center mt-2"
                onPress={addCard}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save Card</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
