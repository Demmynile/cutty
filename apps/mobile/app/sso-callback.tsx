import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useAuthStore, homeFor } from '@/store/authStore'

// Google sign-in returns to the app on cutty://sso-callback. Clerk finishes
// the sign-in in the screen that started it; this route only keeps the
// router from showing "unmatched route" if Android delivers the deep link.
export default function SSOCallback() {
  const { isAuthenticated, role } = useAuthStore()

  useEffect(() => {
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(auth)')), 4000)
    return () => clearTimeout(t)
  }, [])

  if (isAuthenticated) return <Redirect href={homeFor(role)} />
  return (
    <View className="flex-1 bg-dark-900 items-center justify-center">
      <ActivityIndicator color="#F1A91F" />
    </View>
  )
}
