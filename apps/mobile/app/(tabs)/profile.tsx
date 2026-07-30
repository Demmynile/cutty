import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useAuthStore } from '@/store/authStore'
import { urlFor, formatPrice } from '@/lib/sanity'
import { TIER_COLORS } from '@/constants'
import { Ionicons } from '@expo/vector-icons'

const MENU_ITEMS = [
  { icon: 'calendar-outline', label: 'My Bookings', route: '/(tabs)/bookings' },
  { icon: 'bag-outline', label: 'My Orders', route: '/orders' },
  { icon: 'wallet-outline', label: 'Wallet', route: '/wallet' },
  { icon: 'star-outline', label: 'Loyalty Rewards', route: '/(tabs)/loyalty' },
  { icon: 'settings-outline', label: 'Settings', route: '/settings' },
  { icon: 'help-circle-outline', label: 'Help & Support', route: '/support' },
] as const

export default function ProfileScreen() {
  const { customer, signOut } = useAuthStore()
  const tierColor = TIER_COLORS[customer?.tier || 'bronze']

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <ScrollView className="flex-1 bg-dark-900" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View className="pt-14 pb-6 px-5 bg-dark-800">
        <Text className="text-white text-2xl font-bold mb-5">Profile</Text>

        <View className="flex-row items-center gap-4">
          <View className="w-18 h-18 rounded-full bg-dark-700 items-center justify-center overflow-hidden" style={{ width: 72, height: 72 }}>
            {customer?.avatar ? (
              <Image source={{ uri: urlFor(customer.avatar).width(144).url() }} style={{ width: 72, height: 72 }} contentFit="cover" />
            ) : (
              <Text className="text-primary-400 text-3xl font-bold">
                {customer?.fullName?.charAt(0)?.toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">{customer?.fullName}</Text>
            <Text className="text-dark-400 text-sm">{customer?.email}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: tierColor + '33' }}>
                <Text className="text-xs font-medium capitalize" style={{ color: tierColor }}>{customer?.tier} Member</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity className="p-2">
            <Ionicons name="pencil-outline" size={20} color="#D4891A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View className="mx-5 mt-5 bg-dark-800 rounded-2xl p-4">
        <View className="flex-row justify-around">
          {[
            { label: 'Visits', value: customer?.totalVisits || 0 },
            { label: 'Points', value: customer?.loyaltyPoints || 0 },
            { label: 'Balance', value: formatPrice(customer?.walletBalance || 0) },
          ].map(({ label, value }) => (
            <View key={label} className="items-center">
              <Text className="text-white text-xl font-bold">{value}</Text>
              <Text className="text-dark-400 text-xs mt-1">{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View className="mx-5 mt-5 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 bg-primary-500 rounded-2xl p-4 items-center gap-2"
          onPress={() => router.push('/booking/new')}
        >
          <Ionicons name="cut" size={24} color="white" />
          <Text className="text-white text-sm font-semibold">Book Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-dark-800 border border-primary-500 rounded-2xl p-4 items-center gap-2"
          onPress={() => router.push('/wallet')}
        >
          <Ionicons name="wallet" size={24} color="#D4891A" />
          <Text className="text-primary-400 text-sm font-semibold">Top Up Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Menu */}
      <View className="mx-5 mt-5 bg-dark-800 rounded-2xl overflow-hidden">
        {MENU_ITEMS.map(({ icon, label, route }, i) => (
          <TouchableOpacity
            key={label}
            className={`flex-row items-center px-4 py-4 gap-4 ${i < MENU_ITEMS.length - 1 ? 'border-b border-dark-700' : ''}`}
            onPress={() => router.push(route as any)}
          >
            <View className="w-9 h-9 bg-dark-700 rounded-xl items-center justify-center">
              <Ionicons name={icon as any} size={18} color="#D4891A" />
            </View>
            <Text className="text-white text-base flex-1">{label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#484848" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        className="mx-5 mt-4 bg-dark-800 border border-red-500/30 rounded-2xl p-4 flex-row items-center justify-center gap-3"
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text className="text-red-400 font-medium">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
