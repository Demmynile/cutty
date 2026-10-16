import { View } from 'react-native'
import { router } from 'expo-router'
import { ConversationList } from '@/components/ConversationList'
import { ScreenHeader } from '@/components/ui'

export default function CustomerMessagesScreen() {
  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader title="Messages" subtitle="Your chats with stylists" />
      <ConversationList
        as="customer"
        empty={{ title: 'No chats yet', body: 'Find a stylist and message them about a style, price or time.', action: { label: 'Find a stylist', onPress: () => router.push('/stylists') } }}
      />
    </View>
  )
}
