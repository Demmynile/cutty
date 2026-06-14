import { View, Text, TouchableOpacity, ImageBackground } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

export default function OnboardingScreen() {
  return (
    <View className="flex-1 bg-dark-900">
      <LinearGradient
        colors={['#111111', '#1a1a1a', '#111111']}
        className="flex-1 justify-between px-6 pt-20 pb-12"
      >
        {/* Logo / Brand */}
        <View className="items-center mt-12">
          <View className="w-24 h-24 rounded-full bg-primary-500 items-center justify-center mb-6">
            <Text className="text-white text-4xl font-bold">✂</Text>
          </View>
          <Text className="text-white text-5xl font-bold tracking-wider">CUTTY</Text>
          <Text className="text-primary-400 text-lg mt-2">Your Premium Barbershop</Text>
        </View>

        {/* Features */}
        <View className="gap-4">
          {[
            { icon: '📅', label: 'Book appointments in seconds' },
            { icon: '🛍️', label: 'Shop premium barbing products' },
            { icon: '⭐', label: 'Earn loyalty points & rewards' },
            { icon: '👛', label: 'Wallet for seamless payments' },
          ].map(({ icon, label }) => (
            <View key={label} className="flex-row items-center gap-4">
              <Text className="text-2xl">{icon}</Text>
              <Text className="text-dark-200 text-base">{label}</Text>
            </View>
          ))}
        </View>

        {/* CTA Buttons */}
        <View className="gap-4">
          <TouchableOpacity
            className="bg-primary-500 py-4 rounded-2xl items-center"
            onPress={() => router.push('/(auth)/register')}
          >
            <Text className="text-white text-lg font-semibold">Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-primary-500 py-4 rounded-2xl items-center"
            onPress={() => router.push('/(auth)/login')}
          >
            <Text className="text-primary-400 text-lg font-semibold">I already have an account</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  )
}
