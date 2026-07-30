import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'calendar', label: 'Book appointments in seconds' },
  { icon: 'bag', label: 'Shop premium barbing products' },
  { icon: 'star', label: 'Earn loyalty points & rewards' },
  { icon: 'wallet', label: 'Wallet for seamless payments' },
]

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-dark-900">
      <LinearGradient colors={['#0d0d0d', '#161616', '#0d0d0d']} className="flex-1">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Brand */}
          <View className="items-center">
            <Animated.View entering={FadeIn.duration(700)} className="items-center justify-center" style={{ width: 100, height: 100 }}>
              {/* ambient glow */}
              <View
                className="absolute bg-primary-400"
                style={{ width: 190, height: 190, borderRadius: 95, opacity: 0.1 }}
              />
              {/* gradient ring */}
              <LinearGradient
                colors={['#F4BC4F', '#D4891A', '#7E290A']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#D4891A',
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 10,
                }}
              >
                <View
                  className="bg-dark-900 items-center justify-center"
                  style={{ width: 87, height: 87, borderRadius: 44 }}
                >
                  <Text style={{ color: '#F4BC4F', fontSize: 38, fontWeight: '200', letterSpacing: 1 }}>O</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(600)} className="items-center">
              <Text className="text-white text-4xl mt-7" style={{ fontWeight: '200', letterSpacing: 10 }}>
                CUTTY
              </Text>
              <Text
                className="text-primary-400 mt-2"
                style={{ fontSize: 11, fontWeight: '600', letterSpacing: 3 }}
              >
                PREMIUM BARBERSHOP
              </Text>
            </Animated.View>
          </View>

          {/* Features */}
          <Animated.View entering={FadeInDown.delay(400).duration(600)} className="gap-4 mt-12">
            {FEATURES.map(({ icon, label }) => (
              <View key={label} className="flex-row items-center gap-4 bg-dark-800/60 border border-dark-700 rounded-2xl px-4 py-3.5">
                <View
                  className="items-center justify-center bg-primary-500/10"
                  style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#7E290A' }}
                >
                  <Ionicons name={icon} size={17} color="#F1A91F" />
                </View>
                <Text className="text-dark-100 text-base flex-1">{label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* CTA Buttons */}
          <Animated.View entering={FadeInUp.delay(550).duration(600)} className="gap-4 mt-12">
            <TouchableOpacity
              activeOpacity={0.88}
              className="border border-primary-500 py-4 rounded-2xl items-center"
              onPress={() => router.push('/(auth)/register')}
            >
              <Text className="text-primary-400 text-lg font-semibold">Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              className="border border-dark-600 py-4 rounded-2xl items-center"
              onPress={() => router.push('/(auth)/login')}
            >
              <Text className="text-primary-400 text-lg font-semibold">I already have an account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  )
}
