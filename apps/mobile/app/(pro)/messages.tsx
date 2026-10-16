import { View, Text } from 'react-native'
import { useAuthStore } from '@/store/authStore'
import { ConversationList } from '@/components/ConversationList'
import { Banner } from '@/components/ui'

export default function ProMessagesScreen() {
  const approved = useAuthStore((s) => s.stylist?.status === 'approved')
  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <Text className="text-fg text-2xl font-bold">Messages</Text>
        <Text className="text-dark-400 text-xs mt-0.5">Chats with your customers. Tap ✨ in a chat for AI-suggested replies.</Text>
      </View>
      {approved ? (
        <ConversationList as="stylist" empty={{ title: 'No messages yet', body: 'Customers can message you from your profile once you are live.' }} />
      ) : (
        <View className="p-5"><Banner tone="warning" title="Messaging opens after approval" body="Customers can message you once Cutty approves your profile." /></View>
      )}
    </View>
  )
}
