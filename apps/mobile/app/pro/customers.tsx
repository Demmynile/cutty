import { useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { StylistCustomerStat } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { imageUri } from '@/lib/sanity'
import { invalidate, keys, useProCustomers, useProDashboard, usePullToRefresh, useRefetchOnFocus } from '@/lib/data'
import { useFormatPrice } from '@/lib/currency'
import { TIER_COLORS } from '@/constants'
import { Chip, EmptyState, Loading, PrimaryButton, ScreenHeader } from '@/components/ui'

const QUICK_POINTS = [20, 50, 100, 200]

// Everyone who has had a completed visit or bought from this stylist, with
// visits per customer, products bought and spend. Stylists reward regulars
// with bonus loyalty points (within Cutty's per-award and monthly limits).
export default function ProCustomersScreen() {
  const formatPrice = useFormatPrice()
  const customersQ = useProCustomers()
  const dashQ = useProDashboard()
  const rows = customersQ.isLoading ? null : customersQ.data ?? []
  const totals = dashQ.data?.totals
  const budget = totals ? { used: totals.bonusPointsThisMonth, cap: totals.bonusMonthlyCap } : null
  const [sort, setSort] = useState<'visits' | 'spent' | 'recent'>('visits')
  const [target, setTarget] = useState<StylistCustomerStat | null>(null)
  const [points, setPoints] = useState('50')
  const [note, setNote] = useState('Thanks for being a regular!')
  const [saving, setSaving] = useState(false)
  const { refreshing, onRefresh } = usePullToRefresh(customersQ.refetch, dashQ.refetch)
  useRefetchOnFocus(onRefresh)
  useEffect(() => {
    if (customersQ.error) Alert.alert('Customers', errorMessage(customersQ.error))
  }, [customersQ.error])

  async function award() {
    if (!target) return
    const n = Number(points)
    if (!Number.isInteger(n) || n < 1) return Alert.alert('Points', 'Enter a whole number of points.')
    setSaving(true)
    try {
      const res = await api<{ remainingThisMonth: number }>('POST', `/api/v1/pro/customers/${target.customerId}/bonus`, { points: n, note: note.trim() })
      Alert.alert('Bonus sent', `${target.name} received ${n} points. ${res.remainingThisMonth} points left for this month.`)
      setTarget(null)
      await invalidate(keys.pro.customers, keys.pro.dashboard)
    } catch (err) {
      Alert.alert('Not sent', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) =>
    sort === 'spent' ? b.totalSpent - a.totalSpent : sort === 'recent' ? (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') : b.visits - a.visits,
  ), [rows, sort])

  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader title="Customers" subtitle={budget ? `Bonus points this month: ${budget.used} of ${budget.cap}` : undefined} />
      <View className="px-5 pt-4 flex-row gap-2">
        <Chip label="Most visits" selected={sort === 'visits'} onPress={() => setSort('visits')} />
        <Chip label="Top spend" selected={sort === 'spent'} onPress={() => setSort('spent')} />
        <Chip label="Recent" selected={sort === 'recent'} onPress={() => setSort('recent')} />
      </View>
      {rows === null ? <Loading /> : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c.customerId}
          contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D4891A" onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No customers yet" body="Customers appear here after a completed visit or a paid order." />}
          renderItem={({ item }) => (
            <View className="bg-dark-800 rounded-2xl p-4">
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-full bg-dark-700 overflow-hidden items-center justify-center">
                  {item.avatar ? <Image source={{ uri: imageUri(item.avatar, 88, 88) }} style={{ width: 44, height: 44 }} /> : <Text className="text-primary-400 font-bold">{item.name.charAt(0)}</Text>}
                </View>
                <View className="flex-1">
                  <Text className="text-fg font-semibold">{item.name}</Text>
                  <Text className="text-xs capitalize mt-0.5" style={{ color: TIER_COLORS[item.tier] }}>{item.tier} member{item.lastVisit ? ` · last visit ${item.lastVisit}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => { setTarget(item); setPoints('50') }} className="bg-primary-500/15 border border-primary-500/40 px-3 py-2 rounded-xl flex-row items-center gap-1" accessibilityLabel={`Give ${item.name} bonus points`}>
                  <Ionicons name="gift-outline" size={14} color="#F1A91F" />
                  <Text className="text-primary-400 text-xs font-semibold">Bonus</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row mt-3 pt-3 border-t border-dark-700">
                {[
                  { label: 'Visits', value: item.visits },
                  { label: 'Products', value: item.productsPurchased },
                  { label: 'Spent', value: formatPrice(item.totalSpent) },
                  { label: 'Bonus given', value: item.bonusGiven },
                ].map((s) => (
                  <View key={s.label} className="flex-1 items-center">
                    <Text className="text-fg font-bold" style={{ fontVariant: ['tabular-nums'] }}>{s.value}</Text>
                    <Text className="text-dark-400 text-[11px] mt-0.5">{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView className="flex-1 bg-black/60 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {target && (
            <View className="bg-dark-800 rounded-t-3xl p-6 gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-fg text-xl font-bold">Bonus for {target.name.split(' ')[0]}</Text>
                <TouchableOpacity onPress={() => setTarget(null)} accessibilityLabel="Close"><Ionicons name="close" size={24} color="#888888" /></TouchableOpacity>
              </View>
              <Text className="text-dark-400 text-sm">Points go straight to their Cutty rewards balance and can be redeemed for discounts.</Text>
              <View className="flex-row gap-2">
                {QUICK_POINTS.map((p) => <Chip key={p} label={`${p} pts`} selected={points === String(p)} onPress={() => setPoints(String(p))} />)}
              </View>
              <TextInput className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600" keyboardType="number-pad" value={points} onChangeText={setPoints} placeholder="Points" placeholderTextColor="#686868" />
              <TextInput className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600" value={note} onChangeText={setNote} maxLength={120} placeholder="Message they'll see" placeholderTextColor="#686868" />
              <PrimaryButton label={`Send ${points || 0} points`} onPress={award} loading={saving} icon="gift" />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
