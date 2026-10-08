import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { LOYALTY_REWARDS } from '@cutty/types'
import type { LoyaltyTransaction, LoyaltyReward } from '@cutty/types'
import { TIER_COLORS, POINTS_TO_KOBO_RATE } from '@/constants'
import { Ionicons } from '@expo/vector-icons'

const TIERS = [
  { name: 'bronze', label: 'Bronze', visits: 0, bonus: '5% off bookings' },
  { name: 'silver', label: 'Silver', visits: 5, bonus: '10% off bookings' },
  { name: 'gold', label: 'Gold', visits: 15, bonus: '15% off + free drink' },
  { name: 'platinum', label: 'Platinum', visits: 30, bonus: '20% off + priority booking' },
]


export default function LoyaltyScreen() {
  const { customer, updateCustomer } = useAuthStore()
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [redeemModal, setRedeemModal] = useState(false)
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => {
    if (!customer) return
    api<LoyaltyTransaction[]>('GET', '/api/v1/loyalty/transactions')
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const currentTier = TIERS.find((t) => t.name === customer?.tier) || TIERS[0]
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1]
  const tierColor = TIER_COLORS[customer?.tier || 'bronze']

  async function redeemPoints(option: LoyaltyReward) {
    if (!customer || customer.loyaltyPoints < option.points) {
      Alert.alert('Insufficient Points', `You need ${option.points} points for this reward.`)
      return
    }
    setRedeeming(true)
    try {
      const { code, loyaltyPoints } = await api<{ code: string; loyaltyPoints: number }>('POST', '/api/v1/loyalty/redeem', { rewardId: option.id })
      updateCustomer({ loyaltyPoints })
      api<LoyaltyTransaction[]>('GET', '/api/v1/loyalty/transactions').then(setTransactions).catch(() => {})
      Alert.alert('Redeemed! 🎉', `Your discount code is:\n\n${code}\n\nValid for 30 days.`)
      setRedeemModal(false)
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to redeem points. Please try again.'))
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return <View className="flex-1 bg-dark-900 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
  }

  return (
    <ScrollView className="flex-1 bg-dark-900" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View className="px-5 pt-14 pb-6 bg-dark-800">
        <Text className="text-fg text-2xl font-bold mb-1">Loyalty Rewards</Text>
        <Text className="text-dark-400 text-sm">Earn points, unlock discounts</Text>
      </View>

      {/* Points Card */}
      <View className="mx-5 mt-5 rounded-2xl overflow-hidden" style={{ backgroundColor: tierColor + '22', borderWidth: 1, borderColor: tierColor + '55' }}>
        <View className="p-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium" style={{ color: tierColor }}>Your Points</Text>
              <Text className="text-fg text-4xl font-bold mt-1">{customer?.loyaltyPoints?.toLocaleString()}</Text>
              <Text className="text-dark-400 text-xs mt-1">≈ ₦{((customer?.loyaltyPoints || 0) * POINTS_TO_KOBO_RATE / 100 / 100).toLocaleString()} value</Text>
            </View>
            <View className="items-center">
              <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: tierColor + '33' }}>
                <Text className="text-3xl">⭐</Text>
              </View>
              <Text className="text-sm font-bold capitalize mt-2" style={{ color: tierColor }}>{customer?.tier}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="mt-4 py-3 rounded-xl items-center"
            style={{ backgroundColor: tierColor }}
            onPress={() => setRedeemModal(true)}
          >
            <Text className="text-white font-bold">Redeem Points</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tier Progress */}
      <View className="mx-5 mt-5 bg-dark-800 rounded-2xl p-5">
        <Text className="text-fg font-bold mb-4">Loyalty Tiers</Text>
        <View className="gap-3">
          {TIERS.map((tier) => {
            const isActive = tier.name === customer?.tier
            const isPast = TIERS.indexOf(tier) < TIERS.indexOf(currentTier)
            const tc = TIER_COLORS[tier.name]
            return (
              <View key={tier.name} className={`flex-row items-center p-3 rounded-xl ${isActive ? 'border' : ''}`} style={isActive ? { borderColor: tc + '88', backgroundColor: tc + '11' } : {}}>
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: tc + (isPast || isActive ? 'ff' : '33') }}>
                  {isPast ? <Ionicons name="checkmark" size={14} color="white" /> : <Text className="text-xs font-bold" style={{ color: isPast || isActive ? '#111' : tc }}>{tier.visits}</Text>}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold" style={{ color: isActive ? tc : isPast ? '#888' : '#aaa' }}>{tier.label}</Text>
                  <Text className="text-xs text-dark-400">{tier.bonus}</Text>
                </View>
                {isActive && <View className="bg-primary-500 px-2 py-0.5 rounded-full"><Text className="text-white text-xs font-bold">Current</Text></View>}
                {!isActive && !isPast && <Text className="text-dark-400 text-xs">{tier.visits} visits</Text>}
              </View>
            )
          })}
        </View>
        {nextTier && (
          <View className="mt-4 pt-4 border-t border-dark-700">
            <Text className="text-dark-400 text-sm text-center">
              {nextTier.visits - (customer?.totalVisits || 0)} more visits to reach{' '}
              <Text style={{ color: TIER_COLORS[nextTier.name] }}>{nextTier.label}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* Transaction History */}
      <View className="mx-5 mt-5">
        <Text className="text-fg font-bold mb-3">Points History</Text>
        {transactions.length === 0 ? (
          <View className="bg-dark-800 rounded-2xl p-8 items-center">
            <Text className="text-dark-400">No transactions yet</Text>
          </View>
        ) : (
          <View className="bg-dark-800 rounded-2xl overflow-hidden">
            {transactions.map((tx, i) => (
              <View key={tx._id} className={`flex-row items-center p-4 ${i < transactions.length - 1 ? 'border-b border-dark-700' : ''}`}>
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tx.points > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <Ionicons name={tx.points > 0 ? 'arrow-down' : 'arrow-up'} size={16} color={tx.points > 0 ? '#22C55E' : '#EF4444'} />
                </View>
                <View className="flex-1">
                  <Text className="text-fg text-sm font-medium">{tx.description || tx.type}</Text>
                  <Text className="text-dark-400 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text className={`font-bold ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.points > 0 ? '+' : ''}{tx.points} pts
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Redeem Modal */}
      <Modal visible={redeemModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-dark-800 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-fg text-xl font-bold">Redeem Points</Text>
              <TouchableOpacity onPress={() => setRedeemModal(false)}>
                <Ionicons name="close" size={24} className="text-dark-400" />
              </TouchableOpacity>
            </View>
            <Text className="text-dark-400 text-sm mb-5">Available: {customer?.loyaltyPoints} points</Text>
            <View className="gap-3">
              {LOYALTY_REWARDS.map((option) => {
                const canAfford = (customer?.loyaltyPoints || 0) >= option.points
                return (
                  <TouchableOpacity
                    key={option.id}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${canAfford ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 opacity-50'}`}
                    onPress={() => redeemPoints(option)}
                    disabled={!canAfford || redeeming}
                  >
                    <View>
                      <Text className="text-fg font-semibold">{option.label}</Text>
                      <Text className="text-primary-400 text-sm">{option.points} points</Text>
                    </View>
                    {redeeming ? <ActivityIndicator color="#D4891A" /> : <Ionicons name="chevron-forward" size={20} color="#D4891A" />}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
