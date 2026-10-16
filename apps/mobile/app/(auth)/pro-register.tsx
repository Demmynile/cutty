import { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { getClerkInstance } from '@clerk/expo'
import type { StylistKind, StylistLocation } from '@cutty/types'
import { clearAuthData, clerkErrorMessage } from '@/lib/auth'
import { createStylistProfile, enterAsStylist, withServerRetry, type StylistProfile } from '@/lib/session'
import { useEmailSignUp } from '@/lib/useClerkAuth'
import { AuthField, EmailCodeStep, GoogleButton, OrDivider } from '@/components/auth/AuthParts'
import { LocationPicker } from '@/components/LocationPicker'

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
})
const accountSchema = profileSchema.extend({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })
type FormData = z.infer<typeof accountSchema>

const KINDS: Array<{ id: StylistKind; label: string }> = [
  { id: 'barber', label: 'Barber' },
  { id: 'braider', label: 'Braider' },
  { id: 'both', label: 'Both' },
]

export default function ProRegisterScreen() {
  const emailSignUp = useEmailSignUp()
  // Already signed in with Clerk (e.g. came from Pro sign-in without a
  // profile): only the profile details are needed.
  const [profileOnly, setProfileOnly] = useState(() => !!getClerkInstance().session)
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<StylistKind>('barber')
  // Where they work: customers find stylists on the map, nearest first.
  const [location, setLocation] = useState<StylistLocation | null>(null)
  const [locationError, setLocationError] = useState<string | undefined>()
  const locationRef = useRef(location)
  locationRef.current = location
  const [pending, setPending] = useState<FormData | null>(null)
  const profileOnlyRef = useRef(profileOnly)
  profileOnlyRef.current = profileOnly
  const { control, handleSubmit, trigger, getValues, formState: { errors } } = useForm<FormData>({
    // Re-picks the schema on every validation, since profileOnly can change.
    resolver: (values, ctx, opts) =>
      (profileOnlyRef.current ? zodResolver(profileSchema) : zodResolver(accountSchema))(values, ctx, opts as never) as never,
  })

  function profileFrom(values: Pick<FormData, 'fullName' | 'phone'>): StylistProfile {
    return { fullName: values.fullName.trim(), phone: values.phone.trim(), kind, ...(locationRef.current ? { location: locationRef.current } : {}) }
  }

  function requireLocation() {
    if (locationRef.current) return true
    setLocationError('Add where you work: drop a pin or enter your postcode.')
    return false
  }

  function changeLocation(next: StylistLocation | null) {
    setLocation(next)
    if (next) setLocationError(undefined)
  }

  async function finish(profile: StylistProfile) {
    try {
      await createStylistProfile(profile)
    } catch (err) {
      Alert.alert('Sign up failed', clerkErrorMessage(err, 'Could not create your Pro profile. Please try again.'))
      setProfileOnly(true)
      setPending(null)
    }
  }

  async function onSubmit(data: FormData) {
    if (!requireLocation()) return
    setLoading(true)
    try {
      if (profileOnly) {
        await finish(profileFrom(data))
      } else {
        await emailSignUp.start(data.email, data.password)
        setPending(data)
      }
    } catch (err) {
      Alert.alert('Sign up failed', clerkErrorMessage(err, 'Sign up failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  async function verify(code: string) {
    await emailSignUp.verify(code)
    if (pending) await finish(profileFrom(pending))
  }

  // Google: an existing Pro account just signs in; otherwise use the details entered above.
  async function afterGoogle() {
    try {
      if ((await withServerRetry(enterAsStylist, { attempts: 4 })) === 'ok') return
    } catch (err) {
      Alert.alert('Sign in failed', clerkErrorMessage(err))
      return
    }
    await finish(profileFrom(getValues()))
  }

  async function useDifferentAccount() {
    await clearAuthData()
    setProfileOnly(false)
  }

  const fields: Array<{ name: keyof FormData; label: string; placeholder: string; secure?: boolean; keyboard?: 'email-address' | 'phone-pad'; account?: boolean }> = [
    { name: 'fullName', label: 'Full name', placeholder: 'Amaka Obi' },
    { name: 'phone', label: 'Phone number', placeholder: '+234 800 000 0000', keyboard: 'phone-pad' },
    { name: 'email', label: 'Email address', placeholder: 'you@example.com', keyboard: 'email-address', account: true },
    { name: 'password', label: 'Password', placeholder: '••••••••', secure: true, account: true },
    { name: 'confirmPassword', label: 'Confirm password', placeholder: '••••••••', secure: true, account: true },
  ]

  if (pending) {
    return (
      <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <EmailCodeStep email={pending.email} onVerify={verify} onResend={emailSignUp.resend} onBack={() => setPending(null)} submitLabel="Create Pro Account" />
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} className="mb-8" accessibilityRole="button">
          <Text className="text-primary-400 text-base">← Back</Text>
        </TouchableOpacity>
        <Text className="text-primary-400 text-xs font-bold mb-2" style={{ letterSpacing: 3 }}>CUTTY PRO</Text>
        <Text className="text-fg text-3xl font-bold mb-2">{profileOnly ? 'Set up your Pro profile' : 'Join as a stylist'}</Text>
        <Text className="text-dark-400 text-base mb-8">Get booked, sell products and grow your regulars. Cutty reviews every profile before it goes live.</Text>

        <Text className="text-dark-300 text-sm mb-2">I am a</Text>
        <View className="flex-row gap-3 mb-6" accessibilityRole="radiogroup">
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k.id }}
              onPress={() => setKind(k.id)}
              className={`flex-1 py-3 rounded-xl items-center border ${kind === k.id ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'}`}
            >
              <Text className={`font-semibold ${kind === k.id ? '' : 'text-fg'}`} style={kind === k.id ? { color: '#111111' } : undefined}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="gap-5">
          {fields.filter((f) => !profileOnly || !f.account).map(({ name, label, placeholder, secure, keyboard, account }) => (
            <View key={name}>
              {name === 'email' && (
                <>
                  <GoogleButton onSignedIn={afterGoogle} before={async () => (await trigger(['fullName', 'phone'])) && requireLocation()} disabled={loading} />
                  <OrDivider />
                </>
              )}
              <Controller
                control={control}
                name={name}
                render={({ field: { onChange, value } }) => (
                  <AuthField
                    label={label}
                    placeholder={placeholder}
                    secureTextEntry={secure}
                    keyboardType={keyboard}
                    autoCapitalize={account ? 'none' : 'words'}
                    value={value}
                    onChangeText={onChange}
                    error={errors[name]?.message}
                  />
                )}
              />
              {name === 'phone' && (
                <View className="mt-5">
                  <Text className="text-fg font-bold text-base mb-1">Where do you work?</Text>
                  <Text className="text-dark-400 text-xs mb-3">Customers find stylists on the map, nearest first. Drop a pin on your chair, or enter your postcode and we'll fill in the address.</Text>
                  <LocationPicker value={location} onChange={changeLocation} error={locationError} />
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity className="bg-primary-500 py-4 rounded-2xl items-center mt-4" onPress={() => { requireLocation(); handleSubmit(onSubmit)() }} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#111111" /> : <Text className="text-lg font-semibold" style={{ color: '#111111' }}>{profileOnly ? 'Finish setup' : 'Create Pro Account'}</Text>}
          </TouchableOpacity>
        </View>

        {profileOnly ? (
          <TouchableOpacity className="mt-8 items-center" onPress={useDifferentAccount} accessibilityRole="button">
            <Text className="text-dark-400">
              Not you? <Text className="text-primary-400 font-semibold">Use a different account</Text>
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity className="mt-8 items-center" onPress={() => router.replace('/(auth)/pro-login')} accessibilityRole="button">
            <Text className="text-dark-400">
              Already on Cutty Pro? <Text className="text-primary-400 font-semibold">Sign in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
