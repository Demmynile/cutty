import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DARK_THEME_VARS } from '@/lib/theme'
import { getAuthRole, type AuthRole } from '@/lib/auth'

type Icon = keyof typeof Ionicons.glyphMap

const ROLES: Record<AuthRole, {
  icon: Icon
  title: string
  sub: string
  features: Array<{ icon: Icon; label: string }>
  signUp: '/(auth)/register' | '/(auth)/pro-register'
  signIn: '/(auth)/login' | '/(auth)/pro-login'
  signUpLabel: string
}> = {
  customer: {
    icon: 'person',
    title: "I'm a customer",
    sub: 'Book, shop & earn rewards',
    features: [
      { icon: 'calendar', label: 'Book appointments in seconds' },
      { icon: 'bag', label: 'Shop premium hair & grooming products' },
      { icon: 'star', label: 'Earn loyalty points & rewards' },
      { icon: 'wallet', label: 'Wallet for seamless payments' },
    ],
    signUp: '/(auth)/register',
    signIn: '/(auth)/login',
    signUpLabel: 'Create account',
  },
  stylist: {
    icon: 'cut',
    title: "I'm a stylist",
    sub: 'Barber or braider on Cutty Pro',
    features: [
      { icon: 'people', label: 'Get booked by new customers' },
      { icon: 'storefront', label: 'Open your own shop & get paid' },
      { icon: 'chatbubbles', label: 'Chat with clients, with Cutty AI covering when you’re away' },
      { icon: 'trending-up', label: 'Grow with ratings & repeat customers' },
    ],
    signUp: '/(auth)/pro-register',
    signIn: '/(auth)/pro-login',
    signUpLabel: 'Join Cutty Pro',
  },
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()
  const [role, setRole] = useState<AuthRole>('customer')

  // Start on whichever side this device last signed in as.
  useEffect(() => {
    getAuthRole().then(setRole).catch(() => {})
  }, [])

  const current = ROLES[role]

  return (
    <View className="flex-1 bg-dark-900" style={DARK_THEME_VARS}>
      <LinearGradient colors={['#0d0d0d', '#161616', '#0d0d0d']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Brand */}
          <View className="items-center">
            <Animated.View entering={FadeIn.duration(700)} style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
              <View className="absolute bg-primary-400" style={{ width: 160, height: 160, borderRadius: 80, opacity: 0.1 }} />
              <LinearGradient
                colors={['#F4BC4F', '#D4891A', '#7E290A']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#D4891A',
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 10,
                }}
              >
                <View className="bg-dark-900 items-center justify-center" style={{ width: 72, height: 72, borderRadius: 36 }}>
                  <Text style={{ color: '#F4BC4F', fontSize: 32, fontWeight: '200', letterSpacing: 1 }}>O</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ alignItems: 'center' }}>
              <Text className="text-white text-4xl mt-6" style={{ fontWeight: '200', letterSpacing: 10 }}>
                CUTTY
              </Text>
              <Text className="text-primary-400 mt-3" style={{ fontSize: 11, fontWeight: '600', letterSpacing: 3 }}>
                PREMIUM BARBERSHOP & SALON
              </Text>
            </Animated.View>
          </View>

          {/* Role picker */}
          <Animated.View entering={FadeInDown.delay(350).duration(600)} style={{ marginTop: 44 }}>
            <Text className="text-dark-300 text-sm mb-3 text-center">How will you use Cutty?</Text>
            <View className="flex-row gap-3" accessibilityRole="radiogroup">
              {(Object.keys(ROLES) as AuthRole[]).map((id) => {
                const r = ROLES[id]
                const selected = role === id
                return (
                  <TouchableOpacity
                    key={id}
                    activeOpacity={0.88}
                    onPress={() => setRole(id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${r.title}. ${r.sub}`}
                    className={`flex-1 rounded-2xl p-4 border ${selected ? 'border-primary-500 bg-primary-500/10' : 'border-dark-700 bg-dark-800/60'}`}
                  >
                    <View className="flex-row items-start justify-between">
                      <View
                        className={`items-center justify-center ${selected ? 'bg-primary-500' : 'bg-dark-700'}`}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      >
                        <Ionicons name={r.icon} size={19} color={selected ? '#111111' : '#F1A91F'} />
                      </View>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? '#F1A91F' : '#484848'} />
                    </View>
                    <Text className="text-fg font-semibold text-base mt-3">{r.title}</Text>
                    <Text className="text-dark-400 text-xs mt-1 leading-4">{r.sub}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Animated.View>

          {/* Features for the chosen role */}
          <Animated.View key={role} entering={FadeIn.duration(350)} style={{ gap: 12, marginTop: 28 }}>
            {current.features.map(({ icon, label }) => (
              <View key={label} className="flex-row items-center gap-4 px-1">
                <View
                  className="items-center justify-center bg-primary-500/10"
                  style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#7E290A' }}
                >
                  <Ionicons name={icon} size={15} color="#F1A91F" />
                </View>
                <Text className="text-dark-100 text-[15px] flex-1">{label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* CTA Buttons */}
          <Animated.View entering={FadeInUp.delay(550).duration(600)} style={{ gap: 14, marginTop: 40 }}>
            <TouchableOpacity
              activeOpacity={0.88}
              className="bg-primary-500 py-4 rounded-2xl items-center"
              onPress={() => router.push(current.signUp)}
              accessibilityRole="button"
            >
              <Text className="text-lg font-semibold" style={{ color: '#111111' }}>{current.signUpLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              className="border border-dark-600 py-4 rounded-2xl items-center"
              onPress={() => router.push(current.signIn)}
              accessibilityRole="button"
            >
              <Text className="text-primary-400 text-lg font-semibold">
                Sign in as a {role === 'customer' ? 'customer' : 'stylist'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  )
}
