import '../global.css'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Redirect, Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { ClerkProvider, useAuth } from '@clerk/expo'
import { QueryClientProvider } from '@tanstack/react-query'
import { tokenCache } from '@clerk/expo/token-cache'
import { useAuthStore } from '@/store/authStore'
import { useRealtimeWarmup } from '@/lib/realtime'
import { useOnboardingStore } from '@/store/onboardingStore'
import { clearAuthData } from '@/lib/auth'
import { refreshAccount, withServerRetry } from '@/lib/session'
import { loadExchangeRates } from '@/lib/currency'
import { useTheme } from '@/lib/theme'
import { queryClient } from '@/lib/data'

SplashScreen.preventAutoHideAsync()

// Customer and Cutty Pro sign-in is handled by Clerk (email + password or
// Google). The admin dashboard keeps its own login and never uses this key.
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to apps/mobile/.env (see .env.example).')
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ClerkProvider>
  )
}

function AppShell() {
  const { setCustomer, setLoading, signOut } = useAuthStore()
  const authHydrated = useAuthStore((s) => s.hydrated)
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth()
  const [authReady, setAuthReady] = useState(false)
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated)
  const completedOnboarding = useOnboardingStore((s) => s.completedThisSession)
  const segments = useSegments()
  const { scheme, colors, themeVars } = useTheme()
  useRealtimeWarmup(useAuthStore((s) => (s.role === 'stylist' ? s.stylist?._id : s.customer?._id)))

  // Replay the intro slideshow on every cold start until it's dismissed this
  // session. Covers deep-link launches that skip the (auth)/(tabs) layouts.
  const needsOnboarding =
    authReady && onboardingHydrated && !completedOnboarding && segments[0] !== 'onboarding'

  useEffect(() => {
    loadExchangeRates()

    // Safety nets: never leave the splash up if the persisted store can't
    // rehydrate or Clerk can't load (offline). Bootstrap still runs once it does.
    const t = setTimeout(() => {
      useOnboardingStore.setState({ hydrated: true })
      useAuthStore.setState({ hydrated: true })
    }, 3000)
    const clerkTimeout = setTimeout(() => setAuthReady(true), 8000)
    return () => {
      clearTimeout(t)
      clearTimeout(clerkTimeout)
    }
  }, [])

  // Once Clerk has restored its session from the keychain, load the Cutty
  // account for the role the user last signed in as. The app doesn't wait for
  // the API server: a cached account opens straight away, and the refresh keeps
  // retrying in the background until the server is up.
  useEffect(() => {
    if (!clerkLoaded || !authHydrated) return
    function showApp() {
      setLoading(false)
      setAuthReady(true)
    }
    async function bootstrap() {
      if (!isSignedIn) {
        // Also clears the role and tokens left by pre-Clerk builds.
        await clearAuthData()
        setCustomer(null)
        showApp()
        return
      }
      if (useAuthStore.getState().isAuthenticated) showApp()
      try {
        await withServerRetry(refreshAccount, { onRetry: showApp })
      } catch {
        // No Cutty account for this Clerk user any more (deleted, deactivated
        // or setup never finished): end the Clerk session too so sign-in starts clean.
        await signOut()
      } finally {
        showApp()
      }
    }
    bootstrap()
  }, [clerkLoaded, authHydrated])

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
        <Stack.Screen name="(pro)" />
        <Stack.Screen name="stylists" />
        <Stack.Screen name="explore" options={{ animation: 'fade' }} />
        <Stack.Screen name="stylist/[id]" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="ai/search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sso-callback" />
      </Stack>
    </View>
  )
}
