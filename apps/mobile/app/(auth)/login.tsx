import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { sanityClient } from '@/lib/sanity'
import { storeAuthData } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { CUSTOMER_BY_UID } from '@/lib/queries'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const { setCustomer } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ email, password }: FormData) {
    setLoading(true)
    try {
      // In production, replace with your auth provider (Firebase/Supabase/custom)
      // This demo uses email as the UID for simplicity
      const uid = email.toLowerCase().replace(/[^a-z0-9]/g, '')
      const customer = await sanityClient.fetch(CUSTOMER_BY_UID, { uid })
      if (!customer) {
        Alert.alert('Error', 'No account found with this email.')
        return
      }
      await storeAuthData('demo_token', uid)
      setCustomer(customer)
      router.replace('/(tabs)')
    } catch (err) {
      Alert.alert('Error', 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-6 justify-center">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
        <Text className="text-dark-400 text-base mb-10">Sign in to your Cutty account</Text>

        <View className="gap-5">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-2">Email address</Text>
                <TextInput
                  className="bg-dark-800 text-white px-4 py-4 rounded-xl border border-dark-700"
                  placeholder="you@example.com"
                  placeholderTextColor="#686868"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                />
                {errors.email && <Text className="text-red-400 text-xs mt-1">{errors.email.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-2">Password</Text>
                <TextInput
                  className="bg-dark-800 text-white px-4 py-4 rounded-xl border border-dark-700"
                  placeholder="••••••••"
                  placeholderTextColor="#686868"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                />
                {errors.password && <Text className="text-red-400 text-xs mt-1">{errors.password.message}</Text>}
              </View>
            )}
          />

          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center mt-4"
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="mt-8 items-center" onPress={() => router.push('/(auth)/register')}>
          <Text className="text-dark-400">
            Don't have an account?{' '}
            <Text className="text-primary-400 font-semibold">Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
