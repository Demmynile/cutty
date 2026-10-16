import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Ionicons } from '@expo/vector-icons'

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Enter a valid phone number').or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export default function EditProfileScreen() {
  const { customer, updateCustomer } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: customer?.fullName || '', phone: customer?.phone || '' },
  })

  async function onSubmit({ fullName, phone }: FormData) {
    if (!customer) return
    setSaving(true)
    try {
      await api('PATCH', '/api/v1/me', { fullName, phone: phone || null })
      updateCustomer({ fullName, phone: phone || undefined })
      Alert.alert('Saved', 'Your profile has been updated.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Failed to update profile. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <Text className="text-fg text-xl font-bold">Edit Profile</Text>
      </View>

      <View className="flex-1 px-5 pt-6">
        <View className="gap-5">
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-2">Full Name</Text>
                <TextInput
                  className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
                  placeholder="John Doe"
                  placeholderTextColor="#686868"
                  value={value}
                  onChangeText={onChange}
                />
                {errors.fullName && <Text className="text-red-400 text-xs mt-1">{errors.fullName.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text className="text-dark-300 text-sm mb-2">Phone Number</Text>
                <TextInput
                  className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
                  placeholder="+234 800 000 0000"
                  placeholderTextColor="#686868"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                />
                {errors.phone && <Text className="text-red-400 text-xs mt-1">{errors.phone.message}</Text>}
              </View>
            )}
          />

          <View>
            <Text className="text-dark-300 text-sm mb-2">Email</Text>
            <View className="bg-dark-800/60 px-4 py-4 rounded-xl border border-dark-700 flex-row items-center justify-between">
              <Text className="text-dark-400">{customer?.email}</Text>
              <Ionicons name="lock-closed-outline" size={16} className="text-dark-600" />
            </View>
            <Text className="text-dark-500 text-xs mt-1">Email can't be changed since it's tied to your account.</Text>
          </View>

          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center mt-2"
            onPress={handleSubmit(onSubmit)}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-semibold">Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
