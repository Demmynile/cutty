import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { clerkErrorMessage, type AuthRole } from '@/lib/auth'
import { enterAsCustomer, enterAsStylist, withServerRetry } from '@/lib/session'
import { isTransientError } from '@/lib/api'
import { useEmailSignIn } from '@/lib/useClerkAuth'
import { AuthField, EmailCodeStep, GoogleButton, OrDivider } from './AuthParts'
import { FEATURES } from '@/lib/features'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type FormData = z.infer<typeof schema>

const COPY: Record<AuthRole, { eyebrow?: string; title: string; subtitle: string; signUpPrompt: string; signUpLabel: string; signUpRoute: '/(auth)/register' | '/(auth)/pro-register' }> = {
  customer: {
    title: 'Welcome back',
    subtitle: 'Sign in to your Cutty account',
    signUpPrompt: "Don't have an account?",
    signUpLabel: 'Sign up',
    signUpRoute: '/(auth)/register',
  },
  stylist: {
    eyebrow: 'CUTTY PRO',
    title: 'Stylist sign in',
    subtitle: FEATURES.shop ? 'Manage your chair, shop and customers' : 'Manage your chair and customers',
    signUpPrompt: 'New to Cutty Pro?',
    signUpLabel: 'Create a Pro account',
    signUpRoute: '/(auth)/pro-register',
  },
}

/** Email/password or Google sign-in for customers and Cutty Pro stylists (Clerk). */
export function SignInScreen({ role }: { role: AuthRole }) {
  const copy = COPY[role]
  const emailSignIn = useEmailSignIn()
  const [loading, setLoading] = useState(false)
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  // The Clerk session is active; load the Cutty account for the chosen role,
  // giving the API server a few seconds if it is still starting up.
  async function enter() {
    try {
      if (role === 'customer') {
        await withServerRetry(() => enterAsCustomer(), { attempts: 4 })
      } else if ((await withServerRetry(enterAsStylist, { attempts: 4 })) === 'needsProfile') {
        router.replace('/(auth)/pro-register')
      }
    } catch (err) {
      Alert.alert(
        'Sign in failed',
        isTransientError(err)
          ? "Can't reach the Cutty server right now. Make sure it's running, then try again."
          : clerkErrorMessage(err, 'Could not load your account. Please try again.'),
      )
    }
  }

  async function onSubmit({ email, password }: FormData) {
    setLoading(true)
    try {
      if ((await emailSignIn.start(email, password)) === 'code') setCodeFor(email)
      else await enter()
    } catch (err) {
      Alert.alert('Sign in failed', clerkErrorMessage(err, 'Login failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 60 }} keyboardShouldPersistTaps="handled">
        {codeFor ? (
          <EmailCodeStep
            email={codeFor}
            onVerify={async (code) => {
              await emailSignIn.verify(code)
              await enter()
            }}
            onResend={emailSignIn.resend}
            onBack={() => setCodeFor(null)}
            submitLabel="Sign In"
          />
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} className="mb-8" accessibilityRole="button">
              <Text className="text-primary-400 text-base">← Back</Text>
            </TouchableOpacity>
            {copy.eyebrow && <Text className="text-primary-400 text-xs font-bold mb-2" style={{ letterSpacing: 3 }}>{copy.eyebrow}</Text>}
            <Text className="text-fg text-3xl font-bold mb-2">{copy.title}</Text>
            <Text className="text-dark-400 text-base mb-8">{copy.subtitle}</Text>

            <GoogleButton onSignedIn={enter} disabled={loading} />
            <OrDivider />

            <View className="gap-5">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <AuthField
                    label="Email address"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <AuthField
                    label="Password"
                    placeholder="••••••••"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                  />
                )}
              />
              <TouchableOpacity
                className="self-end"
                onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { role } })}
                accessibilityRole="button"
              >
                <Text className="text-primary-400 text-sm">Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity className="bg-primary-500 py-4 rounded-2xl items-center mt-2" onPress={handleSubmit(onSubmit)} disabled={loading} accessibilityRole="button">
                {loading ? <ActivityIndicator color="#111111" /> : <Text className="text-lg font-semibold" style={{ color: '#111111' }}>Sign In</Text>}
              </TouchableOpacity>
            </View>

            <Text className="text-dark-500 text-xs text-center mt-6">
              Had a Cutty account before? Sign in with Google or create an account with the same email. Your points and wallet carry over.
            </Text>

            <TouchableOpacity className="mt-6 items-center" onPress={() => router.replace(copy.signUpRoute)} accessibilityRole="button">
              <Text className="text-dark-400">
                {copy.signUpPrompt} <Text className="text-primary-400 font-semibold">{copy.signUpLabel}</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
