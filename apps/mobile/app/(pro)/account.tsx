import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { imageUri } from '@/lib/sanity'
import { useAuthStore } from '@/store/authStore'
import { useFormatPrice } from '@/lib/currency'
import { Loading } from '@/components/ui'
import { FEATURES } from '@/lib/features'

const STATUS_LABEL = { pending: 'Under review', approved: 'Live', rejected: 'Changes needed', suspended: 'Suspended' } as const

export default function ProAccountScreen() {
  const { stylist, signOut } = useAuthStore()
  const formatPrice = useFormatPrice()
  if (!stylist) return <Loading />

  const menu: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress: () => void }> = [
    { icon: 'person-outline', label: 'Profile, skills & styles', sub: `${stylist.skills.length} skills · ${stylist.styles.length} styles`, onPress: () => router.push('/pro/profile-edit') },
    { icon: 'time-outline', label: 'Availability', sub: stylist.weeklyAvailability.length ? `${new Set(stylist.weeklyAvailability.map((w) => w.day)).size} days a week` : 'Not set', onPress: () => router.push('/pro/availability') },
    { icon: 'pricetag-outline', label: 'Appointment price', sub: stylist.bookingPrice != null ? `${formatPrice(stylist.bookingPrice)} · ${stylist.bookingDuration ?? 60} min` : 'Not set: customers can’t book you yet', onPress: () => router.push('/pro/profile-edit') },
    { icon: 'people-outline', label: 'Customers & loyalty bonuses', onPress: () => router.push('/pro/customers') },
    ...(FEATURES.shop ? [{ icon: 'storefront-outline' as const, label: 'Shop & payouts', sub: stylist.shop.status === 'none' ? 'Not set up' : stylist.shop.status, onPress: () => router.push(stylist.shop.status === 'approved' ? '/(pro)/shop' : '/pro/shop-setup') }] : []),
    { icon: 'lock-closed-outline', label: 'Change password', onPress: () => router.push('/change-password') },
  ]

  return (
    <ScrollView className="flex-1 bg-dark-900" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="px-5 pt-14 pb-6 bg-dark-800">
        <Text className="text-fg text-2xl font-bold mb-5">Account</Text>
        <View className="flex-row items-center gap-4">
          <View className="w-18 h-18 rounded-full bg-dark-700 overflow-hidden items-center justify-center" style={{ width: 72, height: 72 }}>
            {stylist.photo ? (
              <Image source={{ uri: imageUri(stylist.photo, 144, 144) }} style={{ width: 72, height: 72 }} contentFit="cover" />
            ) : (
              <Text className="text-primary-400 text-3xl font-bold">{stylist.fullName.charAt(0)}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-fg text-xl font-bold">{stylist.displayName || stylist.fullName}</Text>
            <Text className="text-dark-400 text-sm">{stylist.email}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <View className={`px-2 py-0.5 rounded-full ${stylist.status === 'approved' ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                <Text className={`text-xs font-medium ${stylist.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>{STATUS_LABEL[stylist.status]}</Text>
              </View>
              {stylist.rating ? <Text className="text-dark-300 text-xs">★ {stylist.rating.toFixed(1)}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      <View className="mx-5 mt-5 bg-dark-800 rounded-2xl overflow-hidden">
        {menu.map((m, i) => (
          <TouchableOpacity key={m.label} onPress={m.onPress} className={`flex-row items-center px-4 py-4 gap-4 ${i < menu.length - 1 ? 'border-b border-dark-700' : ''}`}>
            <View className="w-9 h-9 bg-dark-700 rounded-xl items-center justify-center">
              <Ionicons name={m.icon} size={18} color="#D4891A" />
            </View>
            <View className="flex-1">
              <Text className="text-fg text-base">{m.label}</Text>
              {m.sub && <Text className="text-dark-400 text-xs mt-0.5 capitalize">{m.sub}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#686868" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        className="mx-5 mt-4 bg-dark-800 border border-red-500/30 rounded-2xl p-4 flex-row items-center justify-center gap-3"
        onPress={() => Alert.alert('Sign out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/(auth)')) }])}
      >
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text className="text-red-400 font-medium">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
