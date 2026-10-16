import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Crypto from 'expo-crypto'
import type { ChatMessageDoc } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { messagesQuery, queryClient, threadBase } from '@/lib/data'
import { useConversation } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import { ScreenHeader } from '@/components/ui'

type Row = ChatMessageDoc & { pending?: boolean; failed?: boolean }

const PAGE = 50

// Fresh history from the server, keeping anything newer that arrived over the
// socket (or is still sending) while it loaded.
function mergeLatest(rows: ChatMessageDoc[], prev: Row[] | null): Row[] {
  if (!prev) return rows
  const ids = new Set(rows.map((r) => r._id))
  const clientIds = new Set(rows.map((r) => r.clientId).filter(Boolean))
  const newest = rows[0]?.createdAt ?? ''
  const extra = prev.filter((m) => !ids.has(m._id) && !(m.clientId && clientIds.has(m.clientId)) && (m.pending || m.failed || m.createdAt > newest))
  return [...extra, ...rows]
}

// One customer ↔ stylist thread, used by both sides. History comes from the
// API; new messages arrive over the socket. Customers can ask Cutty AI inside
// the thread; stylists can ask for AI-suggested replies.
export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const role = useAuthStore((s) => s.role) ?? 'customer'
  const myId = useAuthStore((s) => (s.role === 'stylist' ? s.stylist?._id : s.customer?._id))
  const base = threadBase(role, id)
  const query = messagesQuery(base)

  // Reopening a thread shows the cached copy at once while it refreshes.
  const [messages, setMessages] = useState<Row[] | null>(() => queryClient.getQueryData<ChatMessageDoc[]>(query.queryKey) ?? null)
  const [hasMore, setHasMore] = useState(true)
  const [text, setText] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [asking, setAsking] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const loadingOlder = useRef(false)

  // Newest first (the list is inverted). Replaces an optimistic copy when the
  // server's version (same clientId) arrives, and ignores duplicates.
  const upsert = useCallback((m: ChatMessageDoc) => {
    setMessages((prev) => {
      const list = prev ?? []
      if (list.some((x) => x._id === m._id)) return list
      const i = m.clientId ? list.findIndex((x) => x.clientId === m.clientId && x.pending) : -1
      if (i >= 0) return [m, ...list.slice(0, i), ...list.slice(i + 1)]
      return [m, ...list]
    })
  }, [])

  const { connected, otherTyping, send, typing } = useConversation(id, upsert)

  // Reuses the request started when the thread was tapped, if it's still running.
  useEffect(() => {
    let cancelled = false
    queryClient
      .fetchQuery(query)
      .then((rows) => {
        if (cancelled) return
        setMessages((prev) => mergeLatest(rows, prev))
        setHasMore(rows.length === PAGE)
      })
      .catch((err) => {
        if (cancelled) return
        if (queryClient.getQueryData(query.queryKey)) return // offline: keep showing the cached copy
        setMessages((prev) => prev ?? [])
        Alert.alert('Could not load chat', errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [base])

  // Keep the cache in step with what's on screen, so the next open is instant.
  useEffect(() => {
    if (messages) queryClient.setQueryData(query.queryKey, messages.filter((m) => !m.pending && !m.failed).slice(0, PAGE))
  }, [messages])

  async function loadOlder() {
    if (!messages?.length || !hasMore || loadingOlder.current) return
    loadingOlder.current = true
    try {
      const oldest = messages[messages.length - 1].createdAt
      const rows = await api<ChatMessageDoc[]>('GET', `${base}/messages?before=${encodeURIComponent(oldest)}`)
      setMessages((prev) => [...(prev ?? []), ...rows.filter((r) => !prev?.some((p) => p._id === r._id))])
      setHasMore(rows.length === PAGE)
    } finally {
      loadingOlder.current = false
    }
  }

  async function sendMessage(body = text.trim()) {
    if (!body || !myId) return
    setText('')
    setSuggestions([])

    if (aiMode && role === 'customer') {
      setAsking(true)
      try {
        const { question, answer } = await api<{ question: ChatMessageDoc; answer: ChatMessageDoc }>('POST', `${base}/ask-ai`, { question: body }, 70_000)
        upsert(question)
        upsert(answer)
      } catch (err) {
        setText(body)
        Alert.alert('Cutty AI', errorMessage(err))
      } finally {
        setAsking(false)
      }
      return
    }

    const clientId = Crypto.randomUUID()
    const optimistic: Row = { _id: `local-${clientId}`, clientId, conversationId: id, senderType: role, senderId: myId, text: body, createdAt: new Date().toISOString(), pending: true }
    setMessages((prev) => [optimistic, ...(prev ?? [])])
    try {
      upsert(await send(body, clientId))
    } catch (err) {
      setMessages((prev) => (prev ?? []).map((m) => (m.clientId === clientId && m.pending ? { ...m, pending: false, failed: true } : m)))
      Alert.alert('Not sent', err instanceof Error ? err.message : 'Message not sent.')
    }
  }

  function retry(m: Row) {
    setMessages((prev) => (prev ?? []).filter((x) => x._id !== m._id))
    sendMessage(m.text)
  }

  async function suggest() {
    setSuggesting(true)
    try {
      const { suggestions } = await api<{ suggestions: string[] }>('POST', `${base}/suggest`, {}, 70_000)
      setSuggestions(suggestions)
    } catch (err) {
      Alert.alert('Suggestions', errorMessage(err))
    } finally {
      setSuggesting(false)
    }
  }

  function renderItem({ item }: { item: Row }) {
    if (item.senderType === 'ai') {
      return (
        <View className="self-start max-w-[88%] rounded-2xl px-4 py-3 bg-primary-500/10 border border-primary-500/30">
          <View className="flex-row items-center gap-1 mb-1">
            <Ionicons name="sparkles" size={12} color="#F1A91F" />
            <Text className="text-primary-400 text-xs font-semibold">Cutty AI</Text>
          </View>
          <Text className="text-fg leading-5">{item.text}</Text>
        </View>
      )
    }
    const mine = item.senderType === role
    return (
      <TouchableOpacity disabled={!item.failed} onPress={() => retry(item)} className={`max-w-[85%] ${mine ? 'self-end' : 'self-start'}`}>
        <View className={`rounded-2xl px-4 py-3 ${mine ? 'bg-primary-500' : 'bg-dark-800'} ${item.pending ? 'opacity-60' : ''}`}>
          <Text className={`leading-5 ${mine ? '' : 'text-fg'}`} style={mine ? { color: '#111111' } : undefined}>{item.text}</Text>
        </View>
        <Text className={`text-[11px] mt-1 ${mine ? 'text-right' : ''} ${item.failed ? 'text-red-400' : 'text-dark-400'}`}>
          {item.failed ? 'Not sent · tap to retry' : item.pending ? 'Sending…' : new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={name ?? 'Chat'}
        subtitle={otherTyping ? 'typing…' : connected ? 'Online chat' : 'Connecting…'}
        right={role === 'stylist' ? (
          <TouchableOpacity onPress={suggest} disabled={suggesting} accessibilityLabel="Suggest replies with AI" hitSlop={10}>
            {suggesting ? <ActivityIndicator color="#F1A91F" /> : <Ionicons name="sparkles" size={22} color="#F1A91F" />}
          </TouchableOpacity>
        ) : undefined}
      />

      {messages === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#D4891A" /></View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m._id}
          renderItem={renderItem}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListFooterComponent={messages.length === 0 ? (
            <Text className="text-dark-400 text-center mt-8">
              {role === 'customer' ? 'Ask about a style, price or a time that works for you.' : 'No messages yet.'}
            </Text>
          ) : null}
        />
      )}

      {suggestions.length > 0 && (
        <View className="px-4 pb-2 gap-2">
          <Text className="text-dark-400 text-xs">AI suggestions — tap to edit before sending</Text>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => { setText(s); setSuggestions([]) }} className="bg-dark-800 border border-primary-500/30 rounded-xl px-3 py-2">
              <Text className="text-fg text-sm">{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {asking && (
        <View className="px-5 pb-2 flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#F1A91F" />
          <Text className="text-dark-400 text-xs">Cutty AI is thinking…</Text>
        </View>
      )}

      <View className="px-4 pt-3 pb-8 bg-dark-800 border-t border-dark-700 flex-row items-end gap-2">
        {role === 'customer' && (
          <TouchableOpacity
            onPress={() => setAiMode((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: aiMode }}
            accessibilityLabel="Ask Cutty AI"
            className={`w-11 h-11 rounded-full items-center justify-center ${aiMode ? 'bg-primary-500' : 'bg-dark-700'}`}
          >
            <Ionicons name="sparkles" size={18} color={aiMode ? '#111111' : '#F1A91F'} />
          </TouchableOpacity>
        )}
        <TextInput
          className="flex-1 bg-dark-700 text-fg px-4 py-3 rounded-2xl border border-dark-600 max-h-28"
          placeholder={aiMode ? 'Ask Cutty AI about styles or care…' : 'Type a message…'}
          placeholderTextColor="#686868"
          value={text}
          onChangeText={(v) => { setText(v); if (!aiMode) typing() }}
          multiline
          maxLength={aiMode ? 1000 : 4000}
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={!text.trim() || asking}
          accessibilityLabel="Send"
          className={`w-11 h-11 rounded-full items-center justify-center ${text.trim() && !asking ? 'bg-primary-500' : 'bg-dark-700'}`}
        >
          <Ionicons name="send" size={18} color={text.trim() && !asking ? '#111111' : '#686868'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
