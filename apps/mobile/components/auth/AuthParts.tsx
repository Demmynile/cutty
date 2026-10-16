import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { clerkErrorMessage } from '@/lib/auth'
import { useGoogleSignIn } from '@/lib/useClerkAuth'

// Pieces shared by the customer and Cutty Pro sign-in / sign-up screens.

export function AuthField({ label, error, ...input }: TextInputProps & { label: string; error?: string }) {
  return (
    <View>
      <Text className="text-dark-300 text-sm mb-2">{label}</Text>
      <TextInput
        className="bg-dark-800 text-fg px-4 py-4 rounded-xl border border-dark-700"
        placeholderTextColor="#686868"
        accessibilityLabel={label}
        {...input}
      />
      {error && <Text className="text-red-400 text-xs mt-1">{error}</Text>}
    </View>
  )
}

/**
 * "Continue with Google". `before` can validate the screen's other fields and
 * return false to stop; `onSignedIn` runs once the Clerk session is active.
 */
export function GoogleButton({ onSignedIn, before, disabled }: { onSignedIn: () => Promise<void>; before?: () => boolean | Promise<boolean>; disabled?: boolean }) {
  const signInWithGoogle = useGoogleSignIn()
  const [busy, setBusy] = useState(false)

  async function press() {
    if (before && !(await before())) return
    setBusy(true)
    try {
      if (await signInWithGoogle()) await onSignedIn()
    } catch (err) {
      // Full error in the Metro logs: Clerk's code and message pinpoint config problems.
      console.warn('[google-sign-in]', JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})))
      Alert.alert('Google sign-in failed', clerkErrorMessage(err, 'Could not sign in with Google. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ busy, disabled: !!disabled }}
      onPress={press}
      disabled={busy || disabled}
      className="border border-dark-600 bg-dark-800 py-4 rounded-2xl flex-row items-center justify-center gap-3"
    >
      {busy ? (
        <ActivityIndicator color="#F1A91F" />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} className="text-fg" />
          <Text className="text-fg text-base font-semibold">Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3 my-6">
      <View className="flex-1 h-px bg-dark-700" />
      <Text className="text-dark-400 text-xs">or</Text>
      <View className="flex-1 h-px bg-dark-700" />
    </View>
  )
}

/** Six-digit email code entry with resend, used after sign-up, new-device sign-in and password reset. */
export function EmailCodeStep({ email, onVerify, onResend, onBack, submitLabel = 'Verify' }: {
  email: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
  submitLabel?: string
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function verify() {
    setBusy(true)
    setError(undefined)
    try {
      await onVerify(code)
    } catch (err) {
      setError(clerkErrorMessage(err, 'That code didn’t work. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      await onResend()
      Alert.alert('Code sent', `We sent a new code to ${email}.`)
    } catch (err) {
      Alert.alert('Could not resend', clerkErrorMessage(err))
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={onBack} className="mb-8" accessibilityRole="button">
        <Text className="text-primary-400 text-base">← Back</Text>
      </TouchableOpacity>
      <Text className="text-fg text-3xl font-bold mb-2">Check your email</Text>
      <Text className="text-dark-400 text-base mb-8">
        Enter the 6-digit code we sent to <Text className="text-fg">{email}</Text>.
      </Text>
      <AuthField
        label="Verification code"
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        error={error}
      />
      <TouchableOpacity
        className={`py-4 rounded-2xl items-center mt-6 ${code.trim().length === 6 ? 'bg-primary-500' : 'bg-dark-600'}`}
        onPress={verify}
        disabled={busy || code.trim().length !== 6}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#111111" /> : <Text className="text-lg font-semibold" style={{ color: '#111111' }}>{submitLabel}</Text>}
      </TouchableOpacity>
      <TouchableOpacity className="mt-6 items-center" onPress={resend} accessibilityRole="button">
        <Text className="text-dark-400">
          Didn’t get it? <Text className="text-primary-400 font-semibold">Resend code</Text>
        </Text>
      </TouchableOpacity>
    </View>
  )
}
