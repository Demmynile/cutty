import { Redirect, Tabs } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { COLORS } from '@/constants'
import { useTheme } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { hydrated, completedThisSession } = useOnboardingStore()
  const { colors } = useTheme()

  // Play the intro slideshow on every app launch, until it's dismissed this session.
  if (hydrated && !completedThisSession) {
    return <Redirect href="/onboarding" />
  }

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors['dark-800'],
          borderTopColor: colors['dark-700'],
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: colors['dark-400'],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="bag" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
