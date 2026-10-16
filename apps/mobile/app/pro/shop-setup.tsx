import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { BankOption, StylistAccount } from '@cutty/types'
import { useBanks } from '@/lib/data'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Banner, Loading, PrimaryButton, ScreenHeader } from '@/components/ui'
import { withShop } from '@/lib/features'

// Shop request: name + payout bank account. The account holder's name is
// confirmed with Paystack before submitting; Cutty creates the split-payment
// subaccount when it approves the shop.
function ShopSetupScreen() {
  const { stylist, setStylist } = useAuthStore()
  const [name, setName] = useState(stylist?.shop.name ?? '')
  const [description, setDescription] = useState(stylist?.shop.description ?? '')
  const banksQ = useBanks()
  const banks = banksQ.data ?? null
  const [bank, setBank] = useState<BankOption | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (banksQ.error) Alert.alert('Banks', errorMessage(banksQ.error))
  }, [banksQ.error])

  // Look up the account name once the number is complete.
  useEffect(() => {
    setAccountName(null)
    if (!bank || !/^\d{10}$/.test(accountNumber)) return
    setResolving(true)
    api<{ accountName: string }>('POST', '/api/v1/pro/banks', { accountNumber, bankCode: bank.code })
      .then((r) => setAccountName(r.accountName))
      .catch((err) => Alert.alert('Account not found', errorMessage(err, 'Check the bank and account number.')))
      .finally(() => setResolving(false))
  }, [bank?.code, accountNumber])

  if (!stylist) return <Loading />
  if (stylist.status !== 'approved') {
    return (
      <View className="flex-1 bg-dark-900">
        <ScreenHeader title="Shop setup" />
        <View className="p-5"><Banner tone="warning" title="Profile approval first" body="You can open a shop once Cutty approves your stylist profile." /></View>
      </View>
    )
  }

  async function submit() {
    if (name.trim().length < 2) return Alert.alert('Shop name', 'Give your shop a name.')
    if (!bank || !accountName) return Alert.alert('Payout account', 'Choose your bank and enter a valid 10-digit account number.')
    setSaving(true)
    try {
      const updated = await api<StylistAccount>('POST', '/api/v1/pro/shop', { name: name.trim(), description: description.trim() || undefined, bankCode: bank.code, accountNumber })
      setStylist(updated)
      Alert.alert('Request sent', 'Cutty will review your shop shortly. You will be able to add products once it is approved.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err) {
      Alert.alert('Not sent', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = (banks ?? []).filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader title="Open your shop" subtitle="Sell products to your customers" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Banner tone="info" title="How payouts work" body="Card payments split automatically through Paystack: your share settles to the account below, and Cutty keeps a small commission. Bank-transfer orders are paid to you directly and you confirm them in the app." />

        <View>
          <Text className="text-dark-300 text-sm mb-2">Shop name</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" placeholder="e.g. Amaka's Hair Care" placeholderTextColor="#686868" value={name} onChangeText={setName} maxLength={60} />
        </View>
        <View>
          <Text className="text-dark-300 text-sm mb-2">What you sell (optional)</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700 h-20" multiline textAlignVertical="top" placeholder="Hair oils, edge control, braiding hair…" placeholderTextColor="#686868" value={description} onChangeText={setDescription} maxLength={500} />
        </View>

        <View>
          <Text className="text-dark-300 text-sm mb-2">Bank</Text>
          <TouchableOpacity onPress={() => setPicking(true)} className="bg-dark-800 px-4 py-3.5 rounded-xl border border-dark-700 flex-row items-center justify-between" disabled={!banks}>
            <Text className={bank ? 'text-fg' : 'text-dark-500'}>{bank?.name ?? (banks ? 'Choose your bank' : 'Loading banks…')}</Text>
            <Ionicons name="chevron-down" size={18} color="#888888" />
          </TouchableOpacity>
        </View>
        <View>
          <Text className="text-dark-300 text-sm mb-2">Account number</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" keyboardType="number-pad" maxLength={10} placeholder="0123456789" placeholderTextColor="#686868" value={accountNumber} onChangeText={(v) => setAccountNumber(v.replace(/\D/g, ''))} />
          {resolving && <View className="flex-row items-center gap-2 mt-2"><ActivityIndicator size="small" color="#D4891A" /><Text className="text-dark-400 text-xs">Checking account…</Text></View>}
          {accountName && <Text className="text-green-400 text-sm mt-2">✓ {accountName}</Text>}
        </View>

        <PrimaryButton label="Send shop request" onPress={submit} loading={saving} disabled={!accountName || name.trim().length < 2} />
      </ScrollView>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View className="flex-1 bg-dark-900">
          <ScreenHeader title="Choose bank" back={false} right={<TouchableOpacity onPress={() => setPicking(false)}><Ionicons name="close" size={24} color="#888888" /></TouchableOpacity>} />
          <View className="px-5 pt-4">
            <TextInput className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700" placeholder="Search banks" placeholderTextColor="#686868" value={query} onChangeText={setQuery} autoFocus />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(b) => b.code}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity className="py-3.5 border-b border-dark-700" onPress={() => { setBank(item); setPicking(false) }}>
                <Text className="text-fg">{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  )
}

// Hidden until the shop launches (v2.0).
export default withShop(ShopSetupScreen)
