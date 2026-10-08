import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Customer } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { storeAuthToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Enter your password'),
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
      const { token, customer } = await api<{ token: string; customer: Customer }>('POST', '/api/v1/auth/login', { email, password })
      await storeAuthToken(token)
      setCustomer(customer)
      router.replace('/(tabs)')
    } catch (err) {
      Alert.alert('Sign in failed', errorMessage(err, 'Login failed. Please try again.'))
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

        <Text className="text-fg text-3xl font-bold mb-2">Welcome back</Text>
        <Text className="text-dark-400 text-base mb-10">Sign in to your Cutty account</Text>

        <View className="gap-5">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-2">Email address</Text>
                <TextInput
                  className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
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
                  className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
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
