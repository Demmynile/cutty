import { useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { AIChatMode, AIChatMessage } from '@cutty/types'
import { useAIChatStore } from '@/store/aiChatStore'
import { sendChatMessage } from '@/lib/ai'
import { captureFromCamera, pickFromLibrary, type PreparedImage } from '@/lib/imagePrep'

const MAX_SENT_MESSAGES = 20

const COPY: Record<AIChatMode, { title: string; subtitle: string; emptyPrompt: string }> = {
  styling: {
    title: 'Styling Assistant',
    subtitle: 'Ask about a style, get personalized suggestions',
    emptyPrompt: 'Try: "What haircut suits a round face?"',
  },
  grooming: {
    title: 'Grooming & Care Guide',
    subtitle: 'Maintenance tips and haircare Q&A',
    emptyPrompt: 'Try: "How often should I get a trim?"',
  },
}

interface FailedSend {
  message: AIChatMessage
  image: PreparedImage | null
  historySnapshot: AIChatMessage[]
}

export default function AIChatScreen() {
  const params = useLocalSearchParams<{ mode: string }>()
  const mode: AIChatMode = params.mode === 'grooming' ? 'grooming' : 'styling'
  const copy = COPY[mode]

  const { history, addMessage, clearMode } = useAIChatStore()
  const messages = history[mode]

  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<PreparedImage | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<FailedSend | null>(null)
  const listRef = useRef<FlatList>(null)

  async function sendToAI(message: AIChatMessage, image: PreparedImage | null, historySnapshot: AIChatMessage[]) {
    setSending(true)
    setFailed(null)
    try {
      const response = await sendChatMessage({
        mode,
        messages: historySnapshot,
        image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
      })
      addMessage(mode, { role: 'assistant', content: response.reply })
    } catch {
      setFailed({ message, image, historySnapshot })
    } finally {
      setSending(false)
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    }
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || sending || failed) return

    const userMessage: AIChatMessage = { role: 'user', content: trimmed }
    const historySnapshot = [...messages, userMessage].slice(-MAX_SENT_MESSAGES)
    const image = pendingImage

    addMessage(mode, userMessage)
    setInput('')
    setPendingImage(null)
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    sendToAI(userMessage, image, historySnapshot)
  }

  function handleRetry() {
    if (!failed) return
    sendToAI(failed.message, failed.image, failed.historySnapshot)
  }

  async function runPicker(picker: () => Promise<PreparedImage | null>) {
    try {
      const image = await picker()
      if (image) setPendingImage(image)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not access photo')
    }
  }

  function handleAttachPhoto() {
    Alert.alert('Attach Photo', undefined, [
      { text: 'Take Photo', onPress: () => runPicker(captureFromCamera) },
      { text: 'Choose from Library', onPress: () => runPicker(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function handleClear() {
    Alert.alert('Clear Chat', 'This will delete your conversation history for this assistant.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearMode(mode) },
    ])
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark-900"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="px-5 pt-14 pb-4 bg-dark-800 flex-row items-center gap-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} className="text-fg" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-fg text-lg font-bold">{copy.title}</Text>
          <Text className="text-dark-400 text-xs">{copy.subtitle}</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="trash-outline" size={20} className="text-dark-400" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
              <Ionicons name="sparkles" size={28} color="#D4891A" />
            </View>
            <Text className="text-dark-400 text-sm text-center">{copy.emptyPrompt}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className={`max-w-[85%] rounded-2xl px-4 py-3 ${item.role === 'user' ? 'self-end bg-primary-500' : 'self-start bg-dark-800'}`}>
            <Text className="text-white leading-5">{item.content}</Text>
          </View>
        )}
      />

      {sending && (
        <View className="px-5 pb-2 flex-row items-center gap-2">
          <ActivityIndicator color="#D4891A" size="small" />
          <Text className="text-dark-400 text-xs">Thinking…</Text>
        </View>
      )}

      {failed && (
        <View className="mx-5 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex-row items-center justify-between">
          <Text className="text-red-400 text-sm flex-1 mr-3">Failed to send. Tap retry.</Text>
          <TouchableOpacity className="bg-red-500/20 px-3 py-1.5 rounded-lg" onPress={handleRetry}>
            <Text className="text-red-300 font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {pendingImage && (
        <View className="mx-5 mb-2 flex-row items-center gap-2">
          <Image source={{ uri: pendingImage.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
          <Text className="text-dark-400 text-xs flex-1">Photo attached</Text>
          <TouchableOpacity onPress={() => setPendingImage(null)}>
            <Ionicons name="close-circle" size={20} className="text-dark-400" />
          </TouchableOpacity>
        </View>
      )}

      <View className="px-5 py-4 bg-dark-800 border-t border-dark-700 flex-row items-end gap-3">
        <TouchableOpacity className="w-11 h-11 rounded-full bg-dark-700 items-center justify-center" onPress={handleAttachPhoto} disabled={sending || !!failed}>
          <Ionicons name="camera" size={20} color="#D4891A" />
        </TouchableOpacity>
        <TextInput
          className="flex-1 bg-dark-700 text-fg px-4 py-3 rounded-2xl border border-dark-600 max-h-28"
          placeholder="Type a message..."
          placeholderTextColor="#686868"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending && !failed}
        />
        <TouchableOpacity
          className={`w-11 h-11 rounded-full items-center justify-center ${input.trim() && !sending && !failed ? 'bg-primary-500' : 'bg-dark-700'}`}
          onPress={handleSend}
          disabled={!input.trim() || sending || !!failed}
        >
          <Ionicons name="arrow-up" size={20} color={input.trim() && !sending && !failed ? 'white' : '#686868'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
