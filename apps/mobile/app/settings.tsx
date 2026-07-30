import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const NOTIFICATION_ROWS: { key: string; label: string; description: string }[] = [
  { key: 'push', label: 'Push Notifications', description: 'Booking reminders & order updates' },
  { key: 'email', label: 'Email Notifications', description: 'Receipts and account activity' },
  { key: 'sms', label: 'SMS Notifications', description: 'Appointment reminders by text' },
  { key: 'promos', label: 'Promotions & Offers', description: 'Deals, discounts and new arrivals' },
]

const PREFERENCE_ROWS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
  { icon: 'language-outline', label: 'Language', value: 'English' },
  { icon: 'cash-outline', label: 'Currency', value: 'NGN (₦)' },
]

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    push: true,
    email: true,
    sms: false,
    promos: true,
  })

  function toggleNotification(key: string) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => Alert.alert('Request Received', 'Contact support to complete account deletion.'),
        },
      ]
    )
  }

  return (
    <ScrollView className="flex-1 bg-dark-900" contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Settings</Text>
      </View>

      {/* Account */}
      <Text className="text-dark-400 text-xs font-semibold mx-5 mt-6 mb-2" style={{ letterSpacing: 1 }}>
        ACCOUNT
      </Text>
      <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        {[
          { icon: 'person-outline' as const, label: 'Edit Profile' },
          { icon: 'lock-closed-outline' as const, label: 'Change Password' },
          { icon: 'card-outline' as const, label: 'Payment Methods' },
        ].map(({ icon, label }, i, arr) => (
          <TouchableOpacity
            key={label}
            className={`flex-row items-center px-4 py-4 gap-4 ${i < arr.length - 1 ? 'border-b border-dark-700' : ''}`}
            onPress={() => Alert.alert(label, 'This section is coming soon.')}
          >
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name={icon} size={18} color="#F1A91F" />
            </View>
            <Text className="text-white text-base flex-1">{label}</Text>
            <Ionicons name="chevron-forward" size={16} color="#484848" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications */}
      <Text className="text-dark-400 text-xs font-semibold mx-5 mt-6 mb-2" style={{ letterSpacing: 1 }}>
        NOTIFICATIONS
      </Text>
      <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        {NOTIFICATION_ROWS.map(({ key, label, description }, i) => (
          <View
            key={key}
            className={`flex-row items-center px-4 py-4 gap-4 ${i < NOTIFICATION_ROWS.length - 1 ? 'border-b border-dark-700' : ''}`}
          >
            <View className="flex-1">
              <Text className="text-white text-base">{label}</Text>
              <Text className="text-dark-400 text-xs mt-0.5">{description}</Text>
            </View>
            <Switch
              value={notifications[key]}
              onValueChange={() => toggleNotification(key)}
              trackColor={{ false: '#282828', true: '#D4891A' }}
              thumbColor="#ffffff"
              ios_backgroundColor="#282828"
            />
          </View>
        ))}
      </View>

      {/* Preferences */}
      <Text className="text-dark-400 text-xs font-semibold mx-5 mt-6 mb-2" style={{ letterSpacing: 1 }}>
        PREFERENCES
      </Text>
      <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        {PREFERENCE_ROWS.map(({ icon, label, value }, i) => (
          <TouchableOpacity
            key={label}
            className={`flex-row items-center px-4 py-4 gap-4 ${i < PREFERENCE_ROWS.length - 1 ? 'border-b border-dark-700' : ''}`}
            onPress={() => Alert.alert(label, 'This section is coming soon.')}
          >
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name={icon} size={18} color="#F1A91F" />
            </View>
            <Text className="text-white text-base flex-1">{label}</Text>
            <Text className="text-dark-400 text-sm mr-1">{value}</Text>
            <Ionicons name="chevron-forward" size={16} color="#484848" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Support link */}
      <Text className="text-dark-400 text-xs font-semibold mx-5 mt-6 mb-2" style={{ letterSpacing: 1 }}>
        MORE
      </Text>
      <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <TouchableOpacity
          className="flex-row items-center px-4 py-4 gap-4"
          onPress={() => router.push('/support')}
        >
          <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
            <Ionicons name="help-circle-outline" size={18} color="#F1A91F" />
          </View>
          <Text className="text-white text-base flex-1">Help & Support</Text>
          <Ionicons name="chevron-forward" size={16} color="#484848" />
        </TouchableOpacity>
      </View>

      {/* Danger zone */}
      <TouchableOpacity
        className="mx-5 mt-6 bg-dark-800 border border-red-500/30 rounded-2xl p-4 flex-row items-center justify-center gap-3"
        onPress={confirmDeleteAccount}
      >
        <Ionicons name="trash-outline" size={18} color="#EF4444" />
        <Text className="text-red-400 font-medium">Delete Account</Text>
      </TouchableOpacity>

      <Text className="text-dark-500 text-xs text-center mt-8">Cutty v1.0.0</Text>
    </ScrollView>
  )
}
