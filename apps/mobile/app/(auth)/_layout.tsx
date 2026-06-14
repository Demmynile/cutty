import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
