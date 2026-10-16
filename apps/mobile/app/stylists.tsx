import { useMemo, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useStylists } from '@/lib/data'
import { Chip, EmptyState, Loading, ScreenHeader } from '@/components/ui'
import { StylistAvatar } from '@/components/StylistAvatar'
import { FEATURES } from '@/lib/features'

const KIND_LABEL = { barber: 'Barber', braider: 'Braider', both: 'Barber & braider' } as const

// Directory of approved Cutty Pro stylists.
export default function StylistsScreen() {
  const { data, isLoading } = useStylists()
  const [kind, setKind] = useState<'all' | 'barber' | 'braider'>('all')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((s) =>
      (kind === 'all' || s.kind === kind || s.kind === 'both') &&
      (!q || s.name.toLowerCase().includes(q) || s.skills.some((k) => k.toLowerCase().includes(q))),
    )
  }, [data, kind, query])

  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader
        title="Stylists"
        subtitle={FEATURES.shop ? 'Book, message or shop from Cutty Pro stylists' : 'Book or message Cutty Pro stylists'}
        right={<TouchableOpacity onPress={() => router.push('/ai/search')} accessibilityLabel="Search with Cutty AI" hitSlop={10}><Ionicons name="sparkles" size={22} color="#F1A91F" /></TouchableOpacity>}
      />
      <View className="px-5 pt-4 gap-3">
        <View className="bg-dark-800 flex-row items-center px-4 py-3 rounded-xl gap-3 border border-dark-700">
          <Ionicons name="search" size={18} color="#686868" />
          <TextInput className="flex-1 text-fg text-sm" placeholder="Search by name or skill (e.g. locs)" placeholderTextColor="#686868" value={query} onChangeText={setQuery} />
        </View>
        <View className="flex-row gap-2">
          <Chip label="All" selected={kind === 'all'} onPress={() => setKind('all')} />
          <Chip label="Barbers" selected={kind === 'barber'} onPress={() => setKind('barber')} />
          <Chip label="Braiders" selected={kind === 'braider'} onPress={() => setKind('braider')} />
        </View>
      </View>
      {isLoading ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={(s) => s._id}
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No stylists found" body="Try another search, or ask Cutty AI to find someone for you." action={{ label: 'Search with AI', onPress: () => router.push('/ai/search') }} />}
          renderItem={({ item: s }) => (
            <TouchableOpacity onPress={() => router.push(`/stylist/${s._id}`)} className="bg-dark-800 rounded-2xl p-4 flex-row gap-4 items-center" accessibilityRole="button">
              <StylistAvatar s={s} />
              <View className="flex-1">
                <Text className="text-fg font-semibold text-base">{s.name}</Text>
                <Text className="text-dark-400 text-xs mt-0.5">
                  {KIND_LABEL[s.kind]}{s.rating ? ` · ★ ${s.rating.toFixed(1)}` : ' · New'}{s.yearsExperience ? ` · ${s.yearsExperience} yrs` : ''}{FEATURES.shop && s.hasShop ? ' · Shop' : ''}
                </Text>
                {s.skills.length > 0 && <Text className="text-dark-300 text-xs mt-1" numberOfLines={1}>{s.skills.slice(0, 4).join(' · ')}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#686868" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}
