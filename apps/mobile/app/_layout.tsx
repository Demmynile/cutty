import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/store/authStore'
import { sanityClient } from '@/lib/sanity'
import { CUSTOMER_BY_UID } from '@/lib/queries'
import { getAuthData } from '@/lib/auth'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { setCustomer, setLoading } = useAuthStore()

  useEffect(() => {
    async function bootstrap() {
      try {
        const { userId } = await getAuthData()
        if (userId) {
          const customer = await sanityClient.fetch(CUSTOMER_BY_UID, { uid: userId })
          setCustomer(customer || null)
        } else {
          setCustomer(null)
        }
      } catch {
        setCustomer(null)
      } finally {
        await SplashScreen.hideAsync()
      }
    }
    bootstrap()
  }, [])

  return (
    <>
      <StatusBar style="light" backgroundColor="#111111" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="wallet" />
      </Stack>
    </>
  )
}
