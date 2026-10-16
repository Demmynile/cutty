import { Redirect, Stack } from 'expo-router'
import { useAuthStore, homeFor } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'

export default function AuthLayout() {
  const { isAuthenticated, isLoading, role } = useAuthStore()
  const { hydrated, completedThisSession } = useOnboardingStore()

  // Play the intro slideshow on every app launch, until it's dismissed this session.
  if (hydrated && !completedThisSession) {
    return <Redirect href="/onboarding" />
  }

  if (!isLoading && isAuthenticated) {
    return <Redirect href={homeFor(role)} />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="pro-login" />
      <Stack.Screen name="pro-register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  )
}
