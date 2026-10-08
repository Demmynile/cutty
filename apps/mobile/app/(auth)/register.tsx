import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Customer } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { storeAuthToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const [loading, setLoading] = useState(false)
  const { setCustomer } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ fullName, email, phone, password }: FormData) {
    setLoading(true)
    try {
      const { token, customer } = await api<{ token: string; customer: Customer }>('POST', '/api/v1/auth/register', { fullName, email, phone, password })
      await storeAuthToken(token)
      setCustomer(customer)
      router.replace('/(tabs)')
    } catch (err) {
      Alert.alert('Registration failed', errorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const fields: Array<{ name: keyof FormData; label: string; placeholder: string; secure?: boolean; keyboard?: any }> = [
    { name: 'fullName', label: 'Full Name', placeholder: 'John Doe' },
    { name: 'email', label: 'Email address', placeholder: 'you@example.com', keyboard: 'email-address' },
    { name: 'phone', label: 'Phone Number', placeholder: '+234 800 000 0000', keyboard: 'phone-pad' },
    { name: 'password', label: 'Password', placeholder: '••••••••', secure: true },
    { name: 'confirmPassword', label: 'Confirm Password', placeholder: '••••••••', secure: true },
  ]

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </TouchableOpacity>

        <Text className="text-fg text-3xl font-bold mb-2">Create account</Text>
        <Text className="text-dark-400 text-base mb-10">Join Cutty and start your journey</Text>

        <View className="gap-5">
          {fields.map(({ name, label, placeholder, secure, keyboard }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="text-dark-300 text-sm mb-2">{label}</Text>
                  <TextInput
                    className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
                    placeholder={placeholder}
                    placeholderTextColor="#686868"
                    secureTextEntry={secure}
                    keyboardType={keyboard}
                    autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors[name] && (
                    <Text className="text-red-400 text-xs mt-1">{errors[name]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center mt-4"
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="mt-8 items-center" onPress={() => router.push('/(auth)/login')}>
          <Text className="text-dark-400">
            Already have an account?{' '}
            <Text className="text-primary-400 font-semibold">Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
