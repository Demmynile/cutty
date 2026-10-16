import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { api, errorMessage } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import { useAuthStore } from '@/store/authStore'
import { useAIChatStore } from '@/store/aiChatStore'
import { useCartStore } from '@/store/cartStore'
import { useThemeStore, type ThemeMode } from '@/store/themeStore'
import type { NotificationPreferences, PreferredLanguage, PreferredCurrency } from '@cutty/types'

const DEFAULT_NOTIFICATIONS: NotificationPreferences = { push: true, email: true, sms: false, promos: true }

const NOTIFICATION_ROWS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'push', label: 'Push Notifications', description: 'Booking reminders & order updates' },
  { key: 'email', label: 'Email Notifications', description: 'Receipts and account activity' },
  { key: 'sms', label: 'SMS Notifications', description: 'Appointment reminders by text' },
  { key: 'promos', label: 'Promotions & Offers', description: 'Deals, discounts and new arrivals' },
]

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
]

const LANGUAGE_OPTIONS: { code: PreferredLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ig', label: 'Igbo' },
]

const CURRENCY_OPTIONS: { code: PreferredCurrency; label: string }[] = [
  { code: 'NGN', label: 'Nigerian Naira (₦)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'GBP', label: 'British Pound (£)' },
]

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-dark-400 text-xs font-semibold mx-5 mt-6 mb-2" style={{ letterSpacing: 1 }}>
      {children}
    </Text>
  )
}

function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean
  title: string
  options: { code: T; label: string }[]
  selected: T
  onSelect: (code: T) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-dark-800 rounded-t-3xl p-6 pb-10">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-fg text-xl font-bold">{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} className="text-dark-400" />
            </TouchableOpacity>
          </View>
          <View className="gap-2">
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.code}
                className={`flex-row items-center justify-between p-4 rounded-xl border ${opt.code === selected ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600'}`}
                onPress={() => onSelect(opt.code)}
              >
                <Text className="text-fg font-medium">{opt.label}</Text>
                {opt.code === selected && <Ionicons name="checkmark-circle" size={20} color="#D4891A" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function SettingsScreen() {
  const { customer, updateCustomer, signOut } = useAuthStore()
  const { colors } = useTheme()
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const aiHistory = useAIChatStore((s) => s.history)
  const clearAIHistory = useAIChatStore((s) => s.clearAll)
  const clearCart = useCartStore((s) => s.clearCart)

  const [langModal, setLangModal] = useState(false)
  const [currencyModal, setCurrencyModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const notifications = { ...DEFAULT_NOTIFICATIONS, ...customer?.notificationPreferences }
  const aiMessageCount = aiHistory.styling.length + aiHistory.grooming.length
  const currentLanguage = LANGUAGE_OPTIONS.find((l) => l.code === (customer?.preferredLanguage || 'en'))!
  const currentCurrency = CURRENCY_OPTIONS.find((c) => c.code === (customer?.preferredCurrency || 'NGN'))!
  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  // Optimistic: flip locally, then roll back if the API rejects the write.
  async function savePreference(updates: Parameters<typeof updateCustomer>[0], rollback: Parameters<typeof updateCustomer>[0]) {
    if (!customer) return
    updateCustomer(updates)
    try {
      await api('PATCH', '/api/v1/me', updates)
    } catch {
      updateCustomer(rollback)
      Alert.alert('Error', 'Could not save your settings. Check your connection and try again.')
    }
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    const next = { ...notifications, [key]: !notifications[key] }
    savePreference({ notificationPreferences: next }, { notificationPreferences: notifications })
  }

  function selectLanguage(code: PreferredLanguage) {
    setLangModal(false)
    if (!customer || code === currentLanguage.code) return
    savePreference({ preferredLanguage: code }, { preferredLanguage: currentLanguage.code })
  }

  function selectCurrency(code: PreferredCurrency) {
    setCurrencyModal(false)
    if (!customer || code === currentCurrency.code) return
    savePreference({ preferredCurrency: code }, { preferredCurrency: currentCurrency.code })
  }

  function confirmClearAIHistory() {
    Alert.alert(
      'Clear AI Chat History',
      `This removes all ${aiMessageCount} messages from your Style Advisor and Grooming Coach chats on this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearAIHistory },
      ]
    )
  }

  function closeDeleteModal() {
    setDeleteModal(false)
    setDeleteConfirm('')
  }

  async function deleteAccount() {
    if (!customer) return
    setDeleting(true)
    try {
      await api('DELETE', '/api/v1/me', { confirm: 'DELETE' })
      clearAIHistory()
      clearCart()
      closeDeleteModal()
      await signOut()
      router.replace('/(auth)')
      Alert.alert('Account deleted', 'Your account and personal data have been removed.')
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Could not delete your account. Please try again.'))
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = deleteConfirm.trim().toUpperCase() === 'DELETE' && !deleting

  return (
    <View className="flex-1 bg-dark-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} className="text-fg" />
          </TouchableOpacity>
          <Text className="text-fg text-xl font-bold">Settings</Text>
        </View>

        {/* Account */}
        <SectionTitle>ACCOUNT</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          {[
            { icon: 'person-outline' as const, label: 'Edit Profile', route: '/edit-profile' as const },
            { icon: 'lock-closed-outline' as const, label: 'Change Password', route: '/change-password' as const },
            { icon: 'card-outline' as const, label: 'Payment Methods', route: '/payment-methods' as const },
          ].map(({ icon, label, route }, i, arr) => (
            <TouchableOpacity
              key={label}
              className={`flex-row items-center px-4 py-4 gap-4 ${i < arr.length - 1 ? 'border-b border-dark-700' : ''}`}
              onPress={() => router.push(route)}
            >
              <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
                <Ionicons name={icon} size={18} color="#D4891A" />
              </View>
              <Text className="text-fg text-base flex-1">{label}</Text>
              <Ionicons name="chevron-forward" size={16} className="text-dark-600" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Appearance */}
        <SectionTitle>APPEARANCE</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl p-1.5 flex-row gap-1.5">
          {THEME_OPTIONS.map(({ mode, label, icon }) => {
            const active = themeMode === mode
            return (
              <TouchableOpacity
                key={mode}
                className={`flex-1 py-3 rounded-xl items-center gap-1 ${active ? 'bg-primary-500' : ''}`}
                onPress={() => setThemeMode(mode)}
              >
                <Ionicons name={icon} size={18} color={active ? 'white' : colors['dark-400']} />
                <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-dark-400'}`}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <Text className="text-dark-500 text-xs mx-5 mt-2">System follows your phone's light or dark setting.</Text>

        {/* Notifications */}
        <SectionTitle>NOTIFICATIONS</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          {NOTIFICATION_ROWS.map(({ key, label, description }, i) => (
            <View
              key={key}
              className={`flex-row items-center px-4 py-4 gap-4 ${i < NOTIFICATION_ROWS.length - 1 ? 'border-b border-dark-700' : ''}`}
            >
              <View className="flex-1">
                <Text className="text-fg text-base">{label}</Text>
                <Text className="text-dark-400 text-xs mt-0.5">{description}</Text>
              </View>
              <Switch
                value={notifications[key]}
                onValueChange={() => toggleNotification(key)}
                trackColor={{ false: colors['dark-700'], true: '#D4891A' }}
                thumbColor="#ffffff"
                ios_backgroundColor={colors['dark-700']}
              />
            </View>
          ))}
        </View>

        {/* Preferences */}
        <SectionTitle>PREFERENCES</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center px-4 py-4 gap-4 border-b border-dark-700"
            onPress={() => setLangModal(true)}
          >
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name="language-outline" size={18} color="#D4891A" />
            </View>
            <Text className="text-fg text-base flex-1">Language</Text>
            <Text className="text-dark-400 text-sm mr-1">{currentLanguage.label}</Text>
            <Ionicons name="chevron-forward" size={16} className="text-dark-600" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-4 gap-4" onPress={() => setCurrencyModal(true)}>
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name="cash-outline" size={18} color="#D4891A" />
            </View>
            <Text className="text-fg text-base flex-1">Currency</Text>
            <Text className="text-dark-400 text-sm mr-1">{currentCurrency.code}</Text>
            <Ionicons name="chevron-forward" size={16} className="text-dark-600" />
          </TouchableOpacity>
        </View>
        <Text className="text-dark-500 text-xs mx-5 mt-2">
          Prices are shown in your chosen currency. Payments and your wallet are always in Naira.
        </Text>

        {/* AI */}
        <SectionTitle>AI ASSISTANT</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center px-4 py-4 gap-4"
            onPress={confirmClearAIHistory}
            disabled={aiMessageCount === 0}
          >
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name="chatbubbles-outline" size={18} color="#D4891A" />
            </View>
            <View className="flex-1">
              <Text className={`text-base ${aiMessageCount === 0 ? 'text-dark-500' : 'text-fg'}`}>Clear AI Chat History</Text>
              <Text className="text-dark-400 text-xs mt-0.5">
                {aiMessageCount === 0
                  ? 'No saved conversations'
                  : `${aiMessageCount} message${aiMessageCount === 1 ? '' : 's'} saved on this device`}
              </Text>
            </View>
            {aiMessageCount > 0 && <Ionicons name="trash-outline" size={18} color="#EF4444" />}
          </TouchableOpacity>
        </View>

        {/* Support link */}
        <SectionTitle>MORE</SectionTitle>
        <View className="mx-5 bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          <TouchableOpacity className="flex-row items-center px-4 py-4 gap-4" onPress={() => router.push('/support')}>
            <View className="w-9 h-9 bg-primary-500/10 rounded-xl items-center justify-center">
              <Ionicons name="help-circle-outline" size={18} color="#D4891A" />
            </View>
            <Text className="text-fg text-base flex-1">Help & Support</Text>
            <Ionicons name="chevron-forward" size={16} className="text-dark-600" />
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <TouchableOpacity
          className="mx-5 mt-6 bg-dark-800 border border-red-500/30 rounded-2xl p-4 flex-row items-center justify-center gap-3"
          onPress={() => setDeleteModal(true)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text className="text-red-500 font-medium">Delete Account</Text>
        </TouchableOpacity>

        <Text className="text-dark-500 text-xs text-center mt-8">Cutty v{appVersion}</Text>
      </ScrollView>

      <OptionSheet
        visible={langModal}
        title="Language"
        options={LANGUAGE_OPTIONS}
        selected={currentLanguage.code}
        onSelect={selectLanguage}
        onClose={() => setLangModal(false)}
      />
      <OptionSheet
        visible={currencyModal}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={currentCurrency.code}
        onSelect={selectCurrency}
        onClose={() => setCurrencyModal(false)}
      />

      <Modal visible={deleteModal} transparent animationType="slide" onRequestClose={closeDeleteModal}>
        <KeyboardAvoidingView
          className="flex-1 bg-black/60 justify-end"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="bg-dark-800 rounded-t-3xl p-6 pb-10">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-fg text-xl font-bold">Delete Account</Text>
              <TouchableOpacity onPress={closeDeleteModal} disabled={deleting}>
                <Ionicons name="close" size={24} className="text-dark-400" />
              </TouchableOpacity>
            </View>
            <Text className="text-dark-400 text-sm mb-5">
              This permanently removes your profile, saved cards, wallet balance and loyalty points. Your booking and
              order history is kept anonymously for the shop's records. This cannot be undone.
            </Text>

            <Text className="text-dark-300 text-sm mb-2">
              Type <Text className="text-red-500 font-bold">DELETE</Text> to confirm
            </Text>
            <TextInput
              className="bg-dark-700 text-fg px-4 py-3 rounded-xl border border-dark-600 mb-5"
              placeholder="DELETE"
              placeholderTextColor="#686868"
              autoCapitalize="characters"
              autoCorrect={false}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              editable={!deleting}
            />

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center ${canDelete ? 'bg-red-500' : 'bg-dark-600'}`}
              onPress={deleteAccount}
              disabled={!canDelete}
            >
              {deleting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Delete My Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
