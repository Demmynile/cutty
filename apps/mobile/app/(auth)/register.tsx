import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { clerkErrorMessage } from '@/lib/auth'
import { enterAsCustomer, withServerRetry } from '@/lib/session'
import { useEmailSignUp } from '@/lib/useClerkAuth'
import { AuthField, EmailCodeStep, GoogleButton, OrDivider } from '@/components/auth/AuthParts'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const emailSignUp = useEmailSignUp()
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<FormData | null>(null)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Step 1: Clerk creates the sign-in and emails a code.
  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await emailSignUp.start(data.email, data.password)
      setPending(data)
    } catch (err) {
      Alert.alert('Registration failed', clerkErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // Step 2: code verified → Clerk session active → create the Cutty account.
  async function verify(code: string) {
    await emailSignUp.verify(code)
    try {
      await withServerRetry(() => enterAsCustomer({ fullName: pending?.fullName, phone: pending?.phone }), { attempts: 4 })
    } catch (err) {
      Alert.alert('Almost there', clerkErrorMessage(err, 'Your sign-in was created but we could not load your account. Please sign in.'))
    }
  }

  async function google() {
    try {
      await withServerRetry(() => enterAsCustomer(), { attempts: 4 })
    } catch (err) {
      Alert.alert('Sign up failed', clerkErrorMessage(err, 'Could not create your account. Please try again.'))
    }
  }

  const fields: Array<{ name: keyof FormData; label: string; placeholder: string; secure?: boolean; keyboard?: 'email-address' | 'phone-pad' }> = [
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
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {pending ? (
          <EmailCodeStep email={pending.email} onVerify={verify} onResend={emailSignUp.resend} onBack={() => setPending(null)} submitLabel="Create Account" />
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} className="mb-8" accessibilityRole="button">
              <Text className="text-primary-400 text-base">← Back</Text>
            </TouchableOpacity>

            <Text className="text-fg text-3xl font-bold mb-2">Create account</Text>
            <Text className="text-dark-400 text-base mb-8">Join Cutty and start your journey</Text>

            <GoogleButton onSignedIn={google} disabled={loading} />
            <OrDivider />

            <View className="gap-5">
              {fields.map(({ name, label, placeholder, secure, keyboard }) => (
                <Controller
                  key={name}
                  control={control}
                  name={name}
                  render={({ field: { onChange, value } }) => (
                    <AuthField
                      label={label}
                      placeholder={placeholder}
                      secureTextEntry={secure}
                      keyboardType={keyboard}
                      autoCapitalize={keyboard === 'email-address' || secure ? 'none' : 'words'}
                      value={value}
                      onChangeText={onChange}
                      error={errors[name]?.message}
                    />
                  )}
                />
              ))}

              <TouchableOpacity
                className="bg-primary-500 py-4 rounded-2xl items-center mt-4"
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <Text className="text-lg font-semibold" style={{ color: '#111111' }}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity className="mt-8 items-center" onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
              <Text className="text-dark-400">
                Already have an account?{' '}
                <Text className="text-primary-400 font-semibold">Sign in</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
