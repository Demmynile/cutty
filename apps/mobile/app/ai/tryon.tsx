import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { TRY_ON_STYLES, type AITryOnStyle } from '@cutty/types'
import { tryOnStyle } from '@/lib/ai'
import { captureFromCamera, pickFromLibrary, type PreparedImage } from '@/lib/imagePrep'

interface Generated {
  uri: string
  base64: string
  mediaType: 'image/jpeg' | 'image/png'
}

export default function TryOnScreen() {
  // Supports arriving from a "Try it on" tap elsewhere in the app (e.g. the
  // style gallery in the booking flow) with a style pre-picked via ?styleId=.
  const params = useLocalSearchParams<{ styleId?: string }>()
  const initialStyle = useRef(TRY_ON_STYLES.find((s) => s.id === params.styleId) ?? null).current
  const didAutoRun = useRef(false)

  const [photo, setPhoto] = useState<PreparedImage | null>(null)
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)
  // Generated previews cached by style id so re-selecting a style doesn't
  // re-run (and re-bill) the image model.
  const [results, setResults] = useState<Record<string, Generated>>({})

  const activeStyle = TRY_ON_STYLES.find((s) => s.id === activeStyleId) ?? null
  const activeResult = activeStyleId ? results[activeStyleId] : undefined

  async function runPicker(picker: () => Promise<PreparedImage | null>) {
    try {
      const picked = await picker()
      if (picked) {
        setPhoto(picked)
        setResults({})
        // Keep the pre-picked style selected for the very first photo so it
        // can auto-run below; a later re-pick clears the selection as usual.
        setActiveStyleId(initialStyle && !didAutoRun.current ? initialStyle.id : null)
        setError(null)
        setComparing(false)
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not access photo')
    }
  }

  // Auto-run the try-on once a photo lands for a style that arrived pre-picked.
  useEffect(() => {
    if (photo && initialStyle && !didAutoRun.current && activeStyleId === initialStyle.id) {
      didAutoRun.current = true
      handleTryStyle(initialStyle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, activeStyleId])

  function handlePickPhoto() {
    Alert.alert('Add a photo', 'A clear, front-facing photo with your hair visible works best.', [
      { text: 'Take Photo', onPress: () => runPicker(captureFromCamera) },
      { text: 'Choose from Library', onPress: () => runPicker(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function handleTryStyle(style: AITryOnStyle) {
    if (!photo || generating) return

    setActiveStyleId(style.id)
    setComparing(false)
    setError(null)

    if (results[style.id]) return // already generated

    setGenerating(true)
    try {
      const res = await tryOnStyle({
        image: { base64: photo.base64, mediaType: photo.mediaType },
        styleId: style.id,
      })
      setResults((prev) => ({
        ...prev,
        [style.id]: {
          base64: res.image.base64,
          mediaType: res.image.mediaType,
          uri: `data:${res.image.mediaType};base64,${res.image.base64}`,
        },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a preview, try again')
    } finally {
      setGenerating(false)
    }
  }

  async function handleShare() {
    if (!activeResult || !activeStyle) return
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot open the share sheet.')
        return
      }
      const ext = activeResult.mediaType === 'image/png' ? 'png' : 'jpg'
      const fileUri = `${FileSystem.cacheDirectory}cutty-tryon-${activeStyle.id}-${Date.now()}.${ext}`
      await FileSystem.writeAsStringAsync(fileUri, activeResult.base64, { encoding: 'base64' })
      await Sharing.shareAsync(fileUri, { mimeType: activeResult.mediaType, dialogTitle: 'Share your try-on' })
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not share the image')
    }
  }

  const previewUri = comparing || !activeResult ? photo?.uri : activeResult.uri

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} className="text-fg" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-fg text-lg font-bold">Virtual Try-On</Text>
          <Text className="text-dark-400 text-xs">See AI previews of haircuts on your photo</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        {!photo ? (
          <>
            {initialStyle && (
              <View className="bg-primary-500/10 border border-primary-500/30 rounded-2xl p-4 flex-row items-center gap-3">
                <Ionicons name="color-wand-outline" size={20} color="#F1A91F" />
                <Text className="text-dark-100 text-sm flex-1">
                  Ready to preview <Text className="font-semibold text-fg">{initialStyle.label}</Text> — add a photo below to see it on you.
                </Text>
              </View>
            )}
            <TouchableOpacity
              className="bg-dark-800 rounded-2xl border border-dark-700 items-center justify-center overflow-hidden"
              style={{ height: 260 }}
              onPress={handlePickPhoto}
            >
              <View className="items-center px-6">
                <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
                  <Ionicons name="camera" size={28} color="#D4891A" />
                </View>
                <Text className="text-fg font-semibold mb-1">Add a photo</Text>
                <Text className="text-dark-400 text-sm text-center">
                  Face the camera in good light with your hairline visible
                </Text>
              </View>
            </TouchableOpacity>
            <Text className="text-dark-400 text-xs text-center px-4">
              Your photo is sent to Cutty&apos;s AI to render each style and isn&apos;t stored.
            </Text>
          </>
        ) : (
          <>
            <View className="rounded-2xl overflow-hidden bg-dark-800 border border-dark-700" style={{ height: 380 }}>
              <Image
                source={{ uri: previewUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
              />

              {generating && (
                <View className="absolute inset-0 bg-black/55 items-center justify-center gap-3">
                  <ActivityIndicator color="#D4891A" size="large" />
                  <Text className="text-white font-medium">Trying on {activeStyle?.label}…</Text>
                  <Text className="text-dark-300 text-xs">This takes a few seconds</Text>
                </View>
              )}

              {!generating && activeResult && (
                <>
                  <View className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full">
                    <Text className="text-white text-xs font-medium">
                      {comparing ? 'Original' : activeStyle?.label}
                    </Text>
                  </View>
                  <Pressable
                    className="absolute bottom-3 right-3 bg-black/60 px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
                    onPressIn={() => setComparing(true)}
                    onPressOut={() => setComparing(false)}
                  >
                    <Ionicons name="eye-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-medium">Hold to compare</Text>
                  </Pressable>
                </>
              )}
            </View>

            <TouchableOpacity onPress={handlePickPhoto} disabled={generating}>
              <Text className="text-primary-400 text-sm text-center">Use a different photo</Text>
            </TouchableOpacity>

            {error && (
              <View className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex-row items-center justify-between">
                <Text className="text-red-400 text-sm flex-1 mr-3">{error}</Text>
                {activeStyle && (
                  <TouchableOpacity className="bg-red-500/20 px-3 py-1.5 rounded-lg" onPress={() => handleTryStyle(activeStyle)}>
                    <Text className="text-red-300 font-semibold text-sm">Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeResult && activeStyle && (
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center bg-dark-800 border border-dark-700 flex-row justify-center gap-2"
                    onPress={handleShare}
                  >
                    <Ionicons name="share-outline" size={18} className="text-fg" />
                    <Text className="text-fg font-semibold text-sm">Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center bg-primary-500 flex-row justify-center gap-2"
                    onPress={() => router.push(`/booking/new?style=${activeStyle.id}`)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="white" />
                    <Text className="text-white font-semibold text-sm">Book this style</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-dark-400 text-xs text-center px-4">
                  AI-generated preview — your real result depends on your hair type and your barber.
                </Text>
              </View>
            )}

            <View className="mt-1">
              <Text className="text-fg font-bold text-base mb-1">
                {activeStyle ? activeStyle.label : 'Pick a style to try'}
              </Text>
              <Text className="text-dark-400 text-sm mb-3">
                {activeStyle ? activeStyle.blurb : 'Tap any style below to see it on your photo.'}
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {TRY_ON_STYLES.map((style) => {
                  const isActive = style.id === activeStyleId
                  const done = !!results[style.id]
                  return (
                    <TouchableOpacity
                      key={style.id}
                      className={`px-3.5 py-2 rounded-full border flex-row items-center gap-1.5 ${
                        isActive ? 'bg-primary-500 border-primary-500' : 'bg-dark-800 border-dark-700'
                      }`}
                      onPress={() => handleTryStyle(style)}
                      disabled={generating}
                    >
                      {done && (
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color={isActive ? 'white' : '#D4891A'}
                        />
                      )}
                      <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-dark-200'}`}>
                        {style.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
