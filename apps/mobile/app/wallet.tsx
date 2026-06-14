import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal } from 'react-native'
import { router } from 'expo-router'
import { writeClient, sanityClient, formatPrice } from '@/lib/sanity'
import { useAuthStore } from '@/store/authStore'
import { WALLET_TRANSACTIONS_BY_CUSTOMER } from '@/lib/queries'
import { WalletTransaction } from '@cutty/types'
import { Ionicons } from '@expo/vector-icons'

const TOPUP_AMOUNTS = [500000, 1000000, 2000000, 5000000]

export default function WalletScreen() {
  const { customer, updateCustomer } = useAuthStore()
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [topupModal, setTopupModal] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!customer) return
    sanityClient.fetch(WALLET_TRANSACTIONS_BY_CUSTOMER, { customerId: customer._id })
      .then(setTransactions).finally(() => setLoading(false))
  }, [])

  async function processTopup() {
    const amount = selectedAmount || (parseFloat(customAmount) * 100)
    if (!amount || amount < 10000) {
      Alert.alert('Invalid Amount', 'Minimum top-up is ₦100.')
      return
    }
    if (!customer) return
    setProcessing(true)
    try {
      // In production, initiate Paystack payment here and verify callback
      const newBalance = customer.walletBalance + amount
      await writeClient.patch(customer._id).set({ walletBalance: newBalance }).commit()
      const tx = await writeClient.create({
        _type: 'walletTransaction',
        customer: { _type: 'reference', _ref: customer._id },
        type: 'credit', category: 'topup', amount,
        balanceAfter: newBalance,
        description: 'Wallet top-up',
        paymentReference: `demo_${Date.now()}`,
        status: 'completed',
        createdAt: new Date().toISOString(),
      })
      updateCustomer({ walletBalance: newBalance })
      setTransactions([{ ...tx, customer: customer as any } as WalletTransaction, ...transactions])
      setTopupModal(false)
      setSelectedAmount(null)
      setCustomAmount('')
      Alert.alert('Success! 💰', `₦${(amount / 100).toLocaleString()} added to your wallet.`)
    } catch {
      Alert.alert('Error', 'Top-up failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold">Wallet</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Balance Card */}
        <View className="bg-primary-500 rounded-3xl p-6">
          <Text className="text-primary-100 text-sm">Available Balance</Text>
          <Text className="text-white text-4xl font-bold mt-2">{formatPrice(customer?.walletBalance || 0)}</Text>
          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              className="flex-1 bg-white/20 rounded-2xl py-3 items-center flex-row justify-center gap-2"
              onPress={() => setTopupModal(true)}
            >
              <Ionicons name="add-circle" size={18} color="white" />
              <Text className="text-white font-semibold">Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-white/20 rounded-2xl py-3 items-center flex-row justify-center gap-2">
              <Ionicons name="arrow-up-circle" size={18} color="white" />
              <Text className="text-white font-semibold">Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wallet Info */}
        <View className="bg-dark-800 rounded-2xl p-4 flex-row gap-4">
          <Ionicons name="shield-checkmark" size={24} color="#D4891A" />
          <View className="flex-1">
            <Text className="text-white font-medium">Secure Wallet</Text>
            <Text className="text-dark-400 text-sm">Your funds are safe. Use your balance to pay for bookings and orders instantly.</Text>
          </View>
        </View>

        {/* Transactions */}
        <View>
          <Text className="text-white font-bold mb-3">Transaction History</Text>
          {loading ? (
            <ActivityIndicator color="#D4891A" />
          ) : transactions.length === 0 ? (
            <View className="bg-dark-800 rounded-2xl p-8 items-center">
              <Ionicons name="receipt-outline" size={48} color="#484848" />
              <Text className="text-dark-400 mt-3">No transactions yet</Text>
            </View>
          ) : (
            <View className="bg-dark-800 rounded-2xl overflow-hidden">
              {transactions.map((tx, i) => (
                <View key={tx._id} className={`flex-row items-center p-4 ${i < transactions.length - 1 ? 'border-b border-dark-700' : ''}`}>
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tx.type === 'credit' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <Ionicons name={tx.type === 'credit' ? 'arrow-down' : 'arrow-up'} size={16} color={tx.type === 'credit' ? '#22C55E' : '#EF4444'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm font-medium">{tx.description || tx.category}</Text>
                    <Text className="text-dark-400 text-xs">{new Date(tx.createdAt).toLocaleString()}</Text>
                    <View className="mt-1 px-2 py-0.5 rounded-full self-start" style={{ backgroundColor: tx.status === 'completed' ? '#22C55E22' : '#F59E0B22' }}>
                      <Text className="text-xs capitalize" style={{ color: tx.status === 'completed' ? '#22C55E' : '#F59E0B' }}>{tx.status}</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                    </Text>
                    <Text className="text-dark-400 text-xs">Bal: {formatPrice(tx.balanceAfter)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Top Up Modal */}
      <Modal visible={topupModal} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-dark-800 rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-white text-xl font-bold">Top Up Wallet</Text>
              <TouchableOpacity onPress={() => setTopupModal(false)}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
            </View>

            <Text className="text-dark-400 text-sm mb-3">Select amount</Text>
            <View className="flex-row flex-wrap gap-3 mb-5">
              {TOPUP_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  className={`px-5 py-3 rounded-xl border ${selectedAmount === amt ? 'bg-primary-500 border-primary-500' : 'bg-dark-700 border-dark-600'}`}
                  onPress={() => { setSelectedAmount(amt); setCustomAmount('') }}
                >
                  <Text className={`font-semibold ${selectedAmount === amt ? 'text-white' : 'text-white'}`}>₦{(amt / 100).toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-dark-400 text-sm mb-2">Or enter custom amount</Text>
            <TextInput
              className="bg-dark-700 text-white px-4 py-3 rounded-xl border border-dark-600 mb-5"
              placeholder="₦ Enter amount..."
              placeholderTextColor="#686868"
              keyboardType="numeric"
              value={customAmount}
              onChangeText={(v) => { setCustomAmount(v); setSelectedAmount(null) }}
            />

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center ${(!selectedAmount && !customAmount) ? 'bg-dark-600' : 'bg-primary-500'}`}
              onPress={processTopup}
              disabled={processing || (!selectedAmount && !customAmount)}
            >
              {processing ? <ActivityIndicator color="white" /> : (
                <Text className="text-white font-bold text-lg">
                  Top Up {selectedAmount ? formatPrice(selectedAmount) : customAmount ? `₦${parseFloat(customAmount).toLocaleString()}` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}
