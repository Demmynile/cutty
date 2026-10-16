import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { clerkErrorMessage } from '@/lib/auth'
import { enterAsCustomer, enterAsStylist } from '@/lib/session'
import { usePasswordReset } from '@/lib/useClerkAuth'
import { AuthField, EmailCodeStep } from '@/components/auth/AuthParts'

type Step = 'email' | 'code' | 'password'

// Clerk password reset: email → 6-digit code → new password. Signs the user
// in at the end (and signs out their other devices).
export default function ForgotPasswordScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>()
  const reset = usePasswordReset()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Invalid email address')
    setBusy(true)
    setError(undefined)
    try {
      await reset.start(email)
      setStep('code')
    } catch (err) {
      setError(clerkErrorMessage(err, 'Could not send a reset code. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function savePassword() {
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError("Passwords don't match")
    setBusy(true)
    setError(undefined)
    try {
      await reset.setPassword(password)
      if (role === 'stylist') {
        if ((await enterAsStylist()) === 'needsProfile') router.replace('/(auth)/pro-register')
      } else {
        await enterAsCustomer()
      }
    } catch (err) {
      Alert.alert('Password reset', clerkErrorMessage(err, 'Could not update your password. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 60 }} keyboardShouldPersistTaps="handled">
        {step === 'code' ? (
          <EmailCodeStep
            email={email.trim()}
            onVerify={async (code) => {
              await reset.verify(code)
              setStep('password')
            }}
            onResend={reset.resend}
            onBack={() => setStep('email')}
            submitLabel="Continue"
          />
        ) : (
          <>
            <TouchableOpacity onPress={() => (step === 'password' ? setStep('email') : router.back())} className="mb-8" accessibilityRole="button">
              <Text className="text-primary-400 text-base">← Back</Text>
            </TouchableOpacity>
            <Text className="text-fg text-3xl font-bold mb-2">{step === 'email' ? 'Reset password' : 'Choose a new password'}</Text>
            <Text className="text-dark-400 text-base mb-8">
              {step === 'email' ? 'We’ll email you a code to reset your password.' : 'You’ll be signed out on your other devices.'}
            </Text>

            <View className="gap-5">
              {step === 'email' ? (
                <AuthField
                  label="Email address"
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  error={error}
                />
              ) : (
                <>
                  <AuthField label="New password" placeholder="••••••••" secureTextEntry autoCapitalize="none" autoComplete="new-password" value={password} onChangeText={setPassword} />
                  <AuthField label="Confirm new password" placeholder="••••••••" secureTextEntry autoCapitalize="none" value={confirm} onChangeText={setConfirm} error={error} />
                </>
              )}
              <TouchableOpacity
                className="bg-primary-500 py-4 rounded-2xl items-center mt-2"
                onPress={step === 'email' ? sendCode : savePassword}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <Text className="text-lg font-semibold" style={{ color: '#111111' }}>{step === 'email' ? 'Send code' : 'Save password'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
