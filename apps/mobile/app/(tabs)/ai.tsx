import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const FEATURES = [
  {
    key: 'search',
    title: 'Find a Stylist',
    description: 'Describe what you want in your own words — get matched stylists, styles and products.',
    icon: 'search' as const,
    href: '/ai/search' as const,
  },
  {
    key: 'styling',
    title: 'Styling Assistant',
    description: 'Chat about what haircut or style would suit you — attach a photo any time.',
    icon: 'sparkles' as const,
    href: '/ai/chat/styling' as const,
  },
  {
    key: 'analyze',
    title: 'Hair Analysis',
    description: 'Get personalized style recommendations from a photo.',
    icon: 'camera' as const,
    href: '/ai/analyze' as const,
  },
  {
    key: 'tryon',
    title: 'Virtual Try-On',
    description: 'Snap a photo and preview AI-rendered haircuts on yourself.',
    icon: 'color-wand' as const,
    href: '/ai/tryon' as const,
  },
  {
    key: 'grooming',
    title: 'Grooming & Care Guide',
    description: 'Maintenance tips, clipper guard explainers, and haircare Q&A.',
    icon: 'leaf' as const,
    href: '/ai/chat/grooming' as const,
  },
]

export default function AIScreen() {
  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-6 bg-dark-800">
        <Text className="text-fg text-2xl font-bold mb-1">AI</Text>
        <Text className="text-dark-400 text-sm">Your smart styling assistant</Text>
      </View>

      <View className="px-5 pt-5 gap-4">
        {FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.key}
            className="bg-dark-800 rounded-2xl p-5 flex-row items-center gap-4 border border-dark-700"
            onPress={() => router.push(feature.href)}
          >
            <View className="w-14 h-14 rounded-full bg-primary-500/20 items-center justify-center">
              <Ionicons name={feature.icon} size={26} color="#D4891A" />
            </View>
            <View className="flex-1">
              <Text className="text-fg text-base font-bold mb-1">{feature.title}</Text>
              <Text className="text-dark-400 text-sm">{feature.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} className="text-dark-500" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
