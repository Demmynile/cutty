import { Redirect, Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { COLORS } from '@/constants'
import { useTheme } from '@/lib/theme'
import { FEATURES } from '@/lib/features'

// Cutty Pro: the stylist side of the app. Only a signed-in stylist gets here;
// customers are sent to their own tabs.
export default function ProLayout() {
  const { isAuthenticated, isLoading, role } = useAuthStore()
  const { colors } = useTheme()

  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)" />
  if (!isLoading && role === 'customer') return <Redirect href="/(tabs)" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors['dark-800'], borderTopColor: colors['dark-700'], borderTopWidth: 1, height: 80, paddingBottom: 16, paddingTop: 8 },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: colors['dark-400'],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="shop" options={{ href: FEATURES.shop ? undefined : null, title: 'Shop', tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }} />
    </Tabs>
  )
}
