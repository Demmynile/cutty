import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, ApiError, errorMessage } from '@/lib/api'
import { storeAuthToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { Ionicons } from '@expo/vector-icons'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type FormData = z.infer<typeof schema>

export default function ChangePasswordScreen() {
  const { customer } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const { control, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ currentPassword, newPassword }: FormData) {
    if (!customer) return
    setSaving(true)
    try {
      // Signs out every other device; this one gets a fresh session token.
      const { token } = await api<{ token: string }>('POST', '/api/v1/me/password', { currentPassword, newPassword })
      await storeAuthToken(token)
      Alert.alert('Password Updated', 'Your password has been changed and other devices have been signed out.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('currentPassword', { message: 'Current password is incorrect' })
        return
      }
      Alert.alert('Error', errorMessage(err, 'Failed to update password. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const fields: { name: keyof FormData; label: string; placeholder: string }[] = [
    { name: 'currentPassword', label: 'Current Password', placeholder: '••••••••' },
    { name: 'newPassword', label: 'New Password', placeholder: '••••••••' },
    { name: 'confirmPassword', label: 'Confirm New Password', placeholder: '••••••••' },
  ]

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <Text className="text-fg text-xl font-bold">Change Password</Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        <View className="gap-5">
          {fields.map(({ name, label, placeholder }) => (
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
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors[name] && <Text className="text-red-400 text-xs mt-1">{errors[name]?.message}</Text>}
                </View>
              )}
            />
          ))}

          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center mt-2"
            onPress={handleSubmit(onSubmit)}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-semibold">Update Password</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
