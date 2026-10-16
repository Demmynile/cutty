import { memo } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import type { StylistPublic } from '@cutty/types'
import { imageUri } from '@/lib/sanity'

export const StylistAvatar = memo(function StylistAvatar({ s, size = 56 }: { s: Pick<StylistPublic, 'name' | 'photo'>; size?: number }) {
  return (
    <View className="rounded-full bg-dark-700 overflow-hidden items-center justify-center" style={{ width: size, height: size }}>
      {s.photo ? (
        <Image source={{ uri: imageUri(s.photo, size * 2, size * 2) }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={`Photo of ${s.name}`} />
      ) : (
        <Text className="text-primary-400 font-bold" style={{ fontSize: size / 2.6 }}>{s.name.charAt(0)}</Text>
      )}
    </View>
  )
})
