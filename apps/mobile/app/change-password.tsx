import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUser } from '@clerk/expo'
import { clerkErrorMessage } from '@/lib/auth'
import { Ionicons } from '@expo/vector-icons'

const schema = z
  .object({
    // Optional here: Google-only accounts have no current password and don't
    // see the field. onSubmit requires it when the account has one.
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type FormData = z.infer<typeof schema>

// Passwords live in Clerk. Google-only accounts have no password yet and can
// set one here without entering a current password.
export default function ChangePasswordScreen() {
  const { user } = useUser()
  const hasPassword = user?.passwordEnabled ?? true
  const [saving, setSaving] = useState(false)

  const { control, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ currentPassword, newPassword }: FormData) {
    if (!user) return
    if (hasPassword && !currentPassword) {
      setError('currentPassword', { message: 'Enter your current password' })
      return
    }
    setSaving(true)
    try {
      await user.updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
        signOutOfOtherSessions: true,
      })
      Alert.alert(
        hasPassword ? 'Password Updated' : 'Password Set',
        'Your password has been saved and other devices have been signed out.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (err) {
      Alert.alert('Error', clerkErrorMessage(err, 'Failed to update password. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const fields: { name: keyof FormData; label: string; placeholder: string }[] = [
    ...(hasPassword ? [{ name: 'currentPassword' as const, label: 'Current Password', placeholder: '••••••••' }] : []),
    { name: 'newPassword', label: 'New Password', placeholder: '••••••••' },
    { name: 'confirmPassword', label: 'Confirm New Password', placeholder: '••••••••' },
  ]

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <Text className="text-fg text-xl font-bold">{hasPassword ? 'Change Password' : 'Set a Password'}</Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        {!hasPassword && (
          <Text className="text-dark-400 text-sm mb-5">
            You sign in with Google. Set a password to also sign in with your email.
          </Text>
        )}
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
                    autoCapitalize="none"
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
            disabled={saving || !user}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-semibold">{hasPassword ? 'Update Password' : 'Set Password'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
