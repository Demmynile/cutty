import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { styleLabel, type StylistAccount } from '@cutty/types'
import { useProDashboard, useProMe, usePullToRefresh, useRefetchOnFocus } from '@/lib/data'
import { useAuthStore } from '@/store/authStore'
import { useFormatPrice } from '@/lib/currency'
import { Banner, Card, Loading, SectionTitle, StatusPill } from '@/components/ui'
import { FEATURES } from '@/lib/features'

function Stat({ label, value, icon, onPress }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} className="bg-dark-800 rounded-2xl p-4" style={{ width: '48%' }} accessibilityRole={onPress ? 'button' : undefined}>
      <View className="w-9 h-9 rounded-xl bg-primary-500/15 items-center justify-center mb-3">
        <Ionicons name={icon} size={18} color="#F1A91F" />
      </View>
      <Text className="text-fg text-2xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text className="text-dark-400 text-xs mt-1">{label}</Text>
    </TouchableOpacity>
  )
}

function setupSteps(s: StylistAccount) {
  return [
    { done: !!s.photo && !!s.bio, label: 'Add a photo and bio', route: '/pro/profile-edit' as const },
    { done: s.skills.length > 0 && s.styles.length > 0, label: 'List your skills and styles', route: '/pro/profile-edit' as const },
    { done: s.weeklyAvailability.length > 0, label: 'Set your weekly hours', route: '/pro/availability' as const },
    { done: s.bookingPrice != null, label: 'Set your appointment price', route: '/pro/profile-edit' as const },
  ]
}

export default function ProDashboard() {
  const formatPrice = useFormatPrice()
  const { stylist, setStylist } = useAuthStore()
  const meQ = useProMe()
  const dashQ = useProDashboard()
  const data = dashQ.data
  const { refreshing, onRefresh } = usePullToRefresh(meQ.refetch, dashQ.refetch)
  useRefetchOnFocus(onRefresh)

  // Keep the signed-in account (status, shop) current everywhere in the app.
  useEffect(() => { if (meQ.data) setStylist(meQ.data as StylistAccount) }, [meQ.data])

  if (!stylist || !data) return <Loading />

  const steps = setupSteps(stylist)
  const remaining = steps.filter((s) => !s.done)
  const t = data.totals

  return (
    <ScrollView
      className="flex-1 bg-dark-900"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D4891A" onRefresh={onRefresh} />}
    >
      <View className="px-5 pt-14 pb-6 bg-dark-800">
        <Text className="text-primary-400 text-xs font-bold" style={{ letterSpacing: 3 }}>CUTTY PRO</Text>
        <Text className="text-fg text-2xl font-bold mt-1">Hi, {(stylist.displayName || stylist.fullName).split(' ')[0]}</Text>
        <Text className="text-dark-400 text-sm mt-1 capitalize">{stylist.kind === 'both' ? 'Barber & braider' : stylist.kind}</Text>
      </View>

      <View className="px-5 mt-5 gap-4">
        {stylist.status === 'pending' && (
          <Banner tone="warning" title="Your profile is under review" body="Cutty checks every stylist before they go live. Finish your setup below so we can approve you faster." />
        )}
        {stylist.status === 'rejected' && (
          <Banner tone="danger" title="Changes needed" body={stylist.reviewNote || 'Update your profile and Cutty will review it again.'} action={{ label: 'Edit profile', onPress: () => router.push('/pro/profile-edit') }} />
        )}
        {FEATURES.shop && stylist.status === 'approved' && stylist.shop.status === 'none' && (
          <Banner tone="info" title="Open your own shop" body="Sell hair and grooming products to your customers. Payments go straight to your bank." action={{ label: 'Set up shop', onPress: () => router.push('/pro/shop-setup') }} />
        )}

        {remaining.length > 0 && (
          <Card>
            <Text className="text-fg font-bold mb-1">Finish setting up</Text>
            <Text className="text-dark-400 text-xs mb-3">{steps.length - remaining.length} of {steps.length} done</Text>
            {steps.map((s) => (
              <TouchableOpacity key={s.label} className="flex-row items-center gap-3 py-2.5" onPress={() => router.push(s.route)} accessibilityRole="button">
                <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={s.done ? '#22C55E' : '#686868'} />
                <Text className={`flex-1 ${s.done ? 'text-dark-400 line-through' : 'text-fg'}`}>{s.label}</Text>
                {!s.done && <Ionicons name="chevron-forward" size={16} color="#686868" />}
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Stat label="Customers" value={t.customers} icon="people" onPress={() => router.push('/pro/customers')} />
          <Stat label="Completed visits" value={t.visits} icon="cut" onPress={() => router.push('/pro/customers')} />
          {FEATURES.shop && <Stat label="Products sold" value={t.productsSold} icon="bag-handle" onPress={() => router.push('/(pro)/shop')} />}
          {FEATURES.shop && <Stat label="Sales to confirm" value={t.pendingSales} icon="hourglass" onPress={() => router.push('/(pro)/shop')} />}
          <Stat label="Booking revenue" value={formatPrice(t.revenueBookings)} icon="cash" />
          {FEATURES.shop && <Stat label="Shop revenue" value={formatPrice(t.revenueProducts)} icon="card" />}
        </View>

        <Card className="flex-row items-center gap-3">
          <Ionicons name="gift" size={22} color="#F1A91F" />
          <View className="flex-1">
            <Text className="text-fg font-semibold">Loyalty bonuses this month</Text>
            <Text className="text-dark-400 text-xs mt-0.5">{t.bonusPointsThisMonth} of {t.bonusMonthlyCap} points given</Text>
            <View className="h-1.5 bg-dark-600 rounded-full mt-2 overflow-hidden">
              <View className="h-full bg-primary-500" style={{ width: `${Math.min(100, (t.bonusPointsThisMonth / Math.max(1, t.bonusMonthlyCap)) * 100)}%` }} />
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/pro/customers')} hitSlop={8}>
            <Text className="text-primary-400 text-sm">Reward →</Text>
          </TouchableOpacity>
        </Card>

        <View>
          <SectionTitle title="Upcoming appointments" action={{ label: 'Schedule', onPress: () => router.push('/(pro)/schedule') }} />
          {data.upcoming.length === 0 ? (
            <Card><Text className="text-dark-400 text-center">No upcoming appointments.</Text></Card>
          ) : (
            <View className="gap-3">
              {data.upcoming.slice(0, 5).map((b) => (
                <Card key={b._id} className="flex-row items-center gap-3">
                  <View className="items-center w-14">
                    <Text className="text-primary-400 font-bold">{b.startTime}</Text>
                    <Text className="text-dark-400 text-xs">{b.bookingDate.slice(5)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-fg font-semibold">{b.customerName}</Text>
                    {b.style && <Text className="text-dark-400 text-xs" numberOfLines={1}>{styleLabel(b.style)}</Text>}
                  </View>
                  <StatusPill status={b.status} />
                </Card>
              ))}
            </View>
          )}
        </View>

        {FEATURES.shop && data.pendingSales.length > 0 && (
          <View>
            <SectionTitle title="Sales to confirm" action={{ label: 'Shop', onPress: () => router.push('/(pro)/shop') }} />
            <View className="gap-3">
              {data.pendingSales.slice(0, 3).map((o) => (
                <Card key={o._id} className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="text-fg font-semibold">#{o.orderNumber}</Text>
                    <Text className="text-dark-400 text-xs">{o.customerName} · {o.items.reduce((n, i) => n + i.quantity, 0)} items · {formatPrice(o.totalAmount)}</Text>
                  </View>
                  <StatusPill status={o.status} />
                </Card>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
