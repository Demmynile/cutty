import '../global.css'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Redirect, Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import type { Customer } from '@cutty/types'
import { api } from '@/lib/api'
import { getAuthToken, clearAuthData } from '@/lib/auth'
import { loadExchangeRates } from '@/lib/currency'
import { useTheme } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { setCustomer } = useAuthStore()
  const [authReady, setAuthReady] = useState(false)
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated)
  const completedOnboarding = useOnboardingStore((s) => s.completedThisSession)
  const segments = useSegments()
  const { scheme, colors, themeVars } = useTheme()

  // Replay the intro slideshow on every cold start until it's dismissed this
  // session. Covers deep-link launches that skip the (auth)/(tabs) layouts.
  const needsOnboarding =
    authReady && onboardingHydrated && !completedOnboarding && segments[0] !== 'onboarding'

  useEffect(() => {
    async function bootstrap() {
      try {
        if (await getAuthToken()) {
          setCustomer(await api<Customer | null>('GET', '/api/v1/me'))
        } else {
          // Also clears the pre-API 'demo_token' + user id left by old builds.
          await clearAuthData()
          setCustomer(null)
        }
      } catch {
        setCustomer(null)
      } finally {
        setAuthReady(true)
      }
    }
    bootstrap()
    loadExchangeRates()

    // Safety net: never leave the splash up if the persisted store can't rehydrate.
    const t = setTimeout(() => useOnboardingStore.setState({ hydrated: true }), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (authReady && onboardingHydrated) {
      SplashScreen.hideAsync()
    }
  }, [authReady, onboardingHydrated])

  return (
    <View style={[{ flex: 1, backgroundColor: colors['dark-900'] }, themeVars]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {needsOnboarding && <Redirect href="/onboarding" />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors['dark-900'] } }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="ai/analyze" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai/tryon" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai/chat/[mode]" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  )
}
