import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import type { ConversationSummary } from '@cutty/types'
import { imageUri } from '@/lib/sanity'
import { prefetchThread, queryClient, useConversations, usePullToRefresh, useRefetchOnFocus } from '@/lib/data'
import { useMessageListener } from '@/lib/realtime'
import { EmptyState, Loading } from './ui'

function timeLabel(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString()
}

function useConversationsWithKey(as: 'customer' | 'stylist') {
  const q = useConversations(as)
  return { ...q, queryKey: as === 'customer' ? ['conversations'] : ['pro', 'conversations'] }
}

// Shared by the customer's Messages screen and the stylist's Messages tab.
// `as` decides whose name/photo is shown and which API lists the threads.
export function ConversationList({ as, empty }: { as: 'customer' | 'stylist'; empty: { title: string; body: string; action?: { label: string; onPress: () => void } } }) {
  const { data: items, isLoading, refetch, queryKey } = useConversationsWithKey(as)
  const { refreshing, onRefresh } = usePullToRefresh(refetch)
  useRefetchOnFocus(refetch)

  // A new message in any thread: move it to the top and bump its unread count.
  useMessageListener((m) => {
    const list = queryClient.getQueryData<ConversationSummary[]>(queryKey)
    const found = list?.find((c) => c._id === m.conversationId)
    if (!list || !found) {
      refetch()
      return
    }
    const mine = m.senderType === as
    const updated = { ...found, lastMessageAt: m.createdAt, lastMessagePreview: m.text, unread: mine ? found.unread : found.unread + 1 }
    queryClient.setQueryData(queryKey, [updated, ...list.filter((c) => c._id !== m.conversationId)])
  })

  if (isLoading) return <Loading />

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(c) => c._id}
      contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 100, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D4891A" onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={empty.title} body={empty.body} action={empty.action} />}
      renderItem={({ item }) => {
        const other = as === 'customer' ? { name: item.stylist.name, image: item.stylist.photo } : { name: item.customer.name, image: item.customer.avatar }
        return (
          <TouchableOpacity
            className="bg-dark-800 rounded-2xl p-4 flex-row items-center gap-3"
            onPress={() => {
              prefetchThread(as, item._id)
              // Opening the thread reads it; clear the badge now rather than on the next refresh.
              if (item.unread) queryClient.setQueryData<ConversationSummary[]>(queryKey, (list) => list?.map((c) => (c._id === item._id ? { ...c, unread: 0 } : c)))
              router.push(`/chat/${item._id}?name=${encodeURIComponent(other.name)}`)
            }}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${other.name}${item.unread ? `, ${item.unread} unread` : ''}`}
          >
            <View className="w-12 h-12 rounded-full bg-dark-700 overflow-hidden items-center justify-center">
              {other.image ? (
                <Image source={{ uri: imageUri(other.image, 96, 96) }} style={{ width: 48, height: 48 }} contentFit="cover" />
              ) : (
                <Text className="text-primary-400 text-lg font-bold">{other.name.charAt(0)}</Text>
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-fg font-semibold flex-1" numberOfLines={1}>{other.name}</Text>
                <Text className="text-dark-400 text-xs">{timeLabel(item.lastMessageAt)}</Text>
              </View>
              <Text className={`text-sm mt-0.5 ${item.unread ? 'text-fg font-medium' : 'text-dark-400'}`} numberOfLines={1}>
                {item.lastMessagePreview || 'No messages yet'}
              </Text>
            </View>
            {item.unread > 0 && (
              <View className="min-w-6 h-6 px-1.5 rounded-full bg-primary-500 items-center justify-center">
                <Text className="text-xs font-bold" style={{ color: '#111111' }}>{item.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )
      }}
    />
  )
}
