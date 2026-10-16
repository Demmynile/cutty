import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { AIAnalyzeResponse } from '@cutty/types'
import { analyzePhoto } from '@/lib/ai'
import { captureFromCamera, pickFromLibrary, type PreparedImage } from '@/lib/imagePrep'

export default function AnalyzeScreen() {
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [notes, setNotes] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AIAnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runPicker(picker: () => Promise<PreparedImage | null>) {
    try {
      const picked = await picker()
      if (picked) {
        setImage(picked)
        setResult(null)
        setError(null)
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not access photo')
    }
  }

  function handlePickPhoto() {
    Alert.alert('Add Photo', undefined, [
      { text: 'Take Photo', onPress: () => runPicker(captureFromCamera) },
      { text: 'Choose from Library', onPress: () => runPicker(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function handleAnalyze() {
    if (!image) return
    setAnalyzing(true)
    setError(null)
    try {
      const response = await analyzePhoto({
        image: { base64: image.base64, mediaType: image.mediaType },
        notes: notes.trim() || undefined,
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed, try again')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleStartOver() {
    setImage(null)
    setNotes('')
    setResult(null)
    setError(null)
  }

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} className="text-fg" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-fg text-lg font-bold">Hair Analysis</Text>
          <Text className="text-dark-400 text-xs">Get style recommendations from a photo</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        {!result && (
          <>
            <TouchableOpacity
              className="bg-dark-800 rounded-2xl border border-dark-700 items-center justify-center overflow-hidden"
              style={{ height: 260 }}
              onPress={handlePickPhoto}
            >
              {image ? (
                <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View className="items-center px-6">
                  <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
                    <Ionicons name="camera" size={28} color="#D4891A" />
                  </View>
                  <Text className="text-fg font-semibold mb-1">Add a photo</Text>
                  <Text className="text-dark-400 text-sm text-center">A clear, front-facing photo works best</Text>
                </View>
              )}
            </TouchableOpacity>

            {image && (
              <TouchableOpacity onPress={handlePickPhoto}>
                <Text className="text-primary-400 text-sm text-center">Choose a different photo</Text>
              </TouchableOpacity>
            )}

            <View>
              <Text className="text-dark-300 text-sm mb-2">Anything specific you're going for? (optional)</Text>
              <TextInput
                className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700 h-20"
                placeholder="e.g. low maintenance, something for a wedding..."
                placeholderTextColor="#686868"
                multiline
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </View>

            {error && (
              <View className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <Text className="text-red-400 text-sm">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center ${image && !analyzing ? 'bg-primary-500' : 'bg-dark-700'}`}
              onPress={handleAnalyze}
              disabled={!image || analyzing}
            >
              {analyzing ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-bold">Analyze</Text>}
            </TouchableOpacity>
          </>
        )}

        {result && (
          <View className="gap-4">
            <View className="bg-dark-800 rounded-2xl p-4 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-dark-400">Face shape</Text>
                <Text className="text-fg flex-1 text-right ml-4">{result.faceShapeRead}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-dark-400">Hair type</Text>
                <Text className="text-fg flex-1 text-right ml-4">{result.hairTypeRead}</Text>
              </View>
            </View>

            <Text className="text-fg font-bold text-base mt-2">Recommended styles</Text>
            {result.recommendations.map((rec, i) => (
              <View key={i} className="bg-dark-800 rounded-2xl p-5 gap-3 border border-dark-700">
                <Text className="text-fg font-bold text-base">{rec.style}</Text>
                <Text className="text-dark-300 text-sm leading-5">{rec.reasoning}</Text>
                <View className="pt-2 border-t border-dark-700">
                  <Text className="text-primary-400 text-xs font-medium mb-1">Maintenance</Text>
                  <Text className="text-dark-300 text-sm leading-5">{rec.maintenanceTips}</Text>
                </View>
                {rec.matchedServiceCategory && (
                  <TouchableOpacity className="mt-1 bg-primary-500/15 py-2.5 rounded-xl items-center" onPress={() => router.push('/booking/new')}>
                    <Text className="text-primary-400 font-semibold text-sm">Find a stylist for this</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {result.generalMaintenanceTips.length > 0 && (
              <View className="bg-dark-800 rounded-2xl p-5 gap-2">
                <Text className="text-fg font-bold mb-1">General tips</Text>
                {result.generalMaintenanceTips.map((tip, i) => (
                  <Text key={i} className="text-dark-300 text-sm leading-5">• {tip}</Text>
                ))}
              </View>
            )}

            <Text className="text-dark-400 text-xs text-center px-4">{result.disclaimer}</Text>

            <TouchableOpacity className="py-4 rounded-2xl items-center bg-dark-800 border border-dark-700" onPress={handleStartOver}>
              <Text className="text-fg font-semibold">Analyze another photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
