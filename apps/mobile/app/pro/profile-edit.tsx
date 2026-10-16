import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Switch } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { TRY_ON_STYLES, type StylistAccount, type StylistKind, type StylistLocation } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { invalidate, keys } from '@/lib/data'
import { imageUri } from '@/lib/sanity'
import { pickFromLibrary, captureFromCamera, type PreparedImage } from '@/lib/imagePrep'
import { uploadProImage } from '@/lib/uploads'
import { useAuthStore } from '@/store/authStore'
import { Chip, Loading, PrimaryButton, ScreenHeader } from '@/components/ui'
import { LocationPicker } from '@/components/LocationPicker'

const DURATIONS = [30, 45, 60, 90, 120, 180, 240]

const SKILL_IDEAS = [
  'Fades', 'Tapers', 'Line-ups', 'Beard sculpting', 'Hot towel shave', 'Kids cuts', 'Waves', 'Hair colouring',
  'Knotless braids', 'Box braids', 'Cornrows', 'Twists', 'Locs', 'Loc retwist', 'Wig install', 'Lace frontal', 'Silk press', 'Natural hair care',
]

const KINDS: Array<{ id: StylistKind; label: string }> = [
  { id: 'barber', label: 'Barber' },
  { id: 'braider', label: 'Braider' },
  { id: 'both', label: 'Both' },
]

export default function ProfileEditScreen() {
  const { stylist, setStylist } = useAuthStore()
  const [displayName, setDisplayName] = useState(stylist?.displayName ?? '')
  const [phone, setPhone] = useState(stylist?.phone ?? '')
  const [bio, setBio] = useState(stylist?.bio ?? '')
  const [years, setYears] = useState(stylist?.yearsExperience?.toString() ?? '')
  const [kind, setKind] = useState<StylistKind>(stylist?.kind ?? 'barber')
  const [skills, setSkills] = useState<string[]>(stylist?.skills ?? [])
  const [styles, setStyles] = useState<string[]>(stylist?.styles ?? [])
  const [newSkill, setNewSkill] = useState('')
  const [newStyle, setNewStyle] = useState('')
  const [photo, setPhoto] = useState<PreparedImage | null>(null)
  const [awayOn, setAwayOn] = useState(stylist?.awayAssistant?.enabled ?? false)
  const [awayNotes, setAwayNotes] = useState(stylist?.awayAssistant?.notes ?? '')
  const [price, setPrice] = useState(stylist?.bookingPrice != null ? String(stylist.bookingPrice / 100) : '')
  const [duration, setDuration] = useState(stylist?.bookingDuration ?? 60)
  const [location, setLocation] = useState<StylistLocation | null>(stylist?.location ?? null)
  const [saving, setSaving] = useState(false)

  if (!stylist) return <Loading />

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  function addCustom(value: string, list: string[], set: (v: string[]) => void, clear: () => void) {
    const v = value.trim()
    if (v.length < 2) return
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) set([...list, v])
    clear()
  }

  async function choosePhoto() {
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => captureFromCamera().then((p) => p && setPhoto(p)).catch((e) => Alert.alert('Camera', e.message)) },
      { text: 'Choose from library', onPress: () => pickFromLibrary().then((p) => p && setPhoto(p)).catch((e) => Alert.alert('Photos', e.message)) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function save() {
    const yearsNum = years.trim() ? Number(years) : null
    if (yearsNum !== null && (!Number.isInteger(yearsNum) || yearsNum < 0 || yearsNum > 70)) {
      Alert.alert('Years of experience', 'Enter a whole number between 0 and 70.')
      return
    }
    // Naira in the form, kobo on the server. Empty keeps whatever is saved.
    const priceNaira = price.trim() ? Number(price.replace(/,/g, '')) : null
    if (priceNaira !== null && (!Number.isFinite(priceNaira) || priceNaira < 1 || priceNaira > 1_000_000)) {
      Alert.alert('Appointment price', 'Enter a price in Naira between ₦1 and ₦1,000,000.')
      return
    }
    setSaving(true)
    try {
      const photoAssetId = photo ? await uploadProImage(photo, 'photo') : undefined
      const updated = await api<StylistAccount>('PATCH', '/api/v1/pro/me', {
        displayName: displayName.trim() || null,
        phone: phone.trim(),
        bio: bio.trim() || null,
        yearsExperience: yearsNum,
        kind,
        skills,
        styles,
        bookingDuration: duration,
        ...(priceNaira !== null ? { bookingPrice: Math.round(priceNaira * 100) } : {}),
        awayAssistant: { enabled: awayOn, notes: awayNotes.trim() || null },
        location,
        ...(photoAssetId ? { photoAssetId } : {}),
      })
      setStylist(updated)
      invalidate(keys.pro.me, keys.stylists)
      router.back()
    } catch (err) {
      Alert.alert('Not saved', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const styleOptions = TRY_ON_STYLES.filter((s) => kind === 'both' || (kind === 'barber' ? s.gender !== 'female' : s.gender !== 'male'))
  const customStyles = styles.filter((s) => !TRY_ON_STYLES.some((t) => t.id === s))

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Your profile" subtitle="This is what customers see" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={choosePhoto} className="items-center" accessibilityLabel="Change profile photo">
          <View className="w-28 h-28 rounded-full bg-dark-800 overflow-hidden items-center justify-center border border-dark-700">
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: 112, height: 112 }} contentFit="cover" />
            ) : stylist.photo ? (
              <Image source={{ uri: imageUri(stylist.photo, 224, 224) }} style={{ width: 112, height: 112 }} contentFit="cover" />
            ) : (
              <Ionicons name="camera" size={32} color="#686868" />
            )}
          </View>
          <Text className="text-primary-400 text-sm mt-2">{stylist.photo || photo ? 'Change photo' : 'Add a photo'}</Text>
        </TouchableOpacity>

        <View>
          <Text className="text-dark-300 text-sm mb-2">I am a</Text>
          <View className="flex-row gap-2">{KINDS.map((k) => <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />)}</View>
        </View>

        {[
          { label: 'Display name (optional)', value: displayName, set: setDisplayName, placeholder: stylist.fullName },
          { label: 'Phone', value: phone, set: setPhone, placeholder: '+234 800 000 0000', keyboard: 'phone-pad' as const },
          { label: 'Years of experience', value: years, set: setYears, placeholder: 'e.g. 6', keyboard: 'number-pad' as const },
        ].map((f) => (
          <View key={f.label}>
            <Text className="text-dark-300 text-sm mb-2">{f.label}</Text>
            <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" placeholder={f.placeholder} placeholderTextColor="#686868" value={f.value} onChangeText={f.set} keyboardType={f.keyboard} />
          </View>
        ))}

        <View>
          <Text className="text-dark-300 text-sm mb-2">Bio</Text>
          <TextInput
            className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700 h-28"
            placeholder="Tell customers about your work, your chair and what you love doing."
            placeholderTextColor="#686868"
            multiline
            textAlignVertical="top"
            maxLength={1000}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        <View>
          <Text className="text-fg font-bold text-base mb-1">Skills</Text>
          <Text className="text-dark-400 text-xs mb-3">Tap to add. Customers and Cutty AI search use these.</Text>
          <View className="flex-row flex-wrap gap-2">
            {[...new Set([...SKILL_IDEAS, ...skills])].map((s) => <Chip key={s} label={s} selected={skills.includes(s)} onPress={() => toggle(skills, setSkills, s)} />)}
          </View>
          <View className="flex-row gap-2 mt-3">
            <TextInput className="flex-1 bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700" placeholder="Add another skill" placeholderTextColor="#686868" value={newSkill} onChangeText={setNewSkill} onSubmitEditing={() => addCustom(newSkill, skills, setSkills, () => setNewSkill(''))} maxLength={60} />
            <TouchableOpacity className="bg-dark-700 px-4 rounded-xl items-center justify-center" onPress={() => addCustom(newSkill, skills, setSkills, () => setNewSkill(''))}><Text className="text-primary-400 font-semibold">Add</Text></TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="text-fg font-bold text-base mb-1">Styles you can do</Text>
          <Text className="text-dark-400 text-xs mb-3">These link to the Virtual Try-On, so customers can preview a look and book you for it.</Text>
          <View className="flex-row flex-wrap gap-2">
            {styleOptions.map((s) => <Chip key={s.id} label={s.label} selected={styles.includes(s.id)} onPress={() => toggle(styles, setStyles, s.id)} />)}
            {customStyles.map((s) => <Chip key={s} label={s} selected onRemove={() => setStyles(styles.filter((x) => x !== s))} />)}
          </View>
          <View className="flex-row gap-2 mt-3">
            <TextInput className="flex-1 bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700" placeholder="Add a style not listed" placeholderTextColor="#686868" value={newStyle} onChangeText={setNewStyle} onSubmitEditing={() => addCustom(newStyle, styles, setStyles, () => setNewStyle(''))} maxLength={60} />
            <TouchableOpacity className="bg-dark-700 px-4 rounded-xl items-center justify-center" onPress={() => addCustom(newStyle, styles, setStyles, () => setNewStyle(''))}><Text className="text-primary-400 font-semibold">Add</Text></TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="text-fg font-bold text-base mb-1">Appointment price</Text>
          <Text className="text-dark-400 text-xs mb-3">Customers book you, not a service menu: this is what one appointment costs and how long it takes. You can't be booked until it's set.</Text>
          <View className="flex-row items-center bg-dark-800 rounded-xl border border-dark-700 px-4">
            <Text className="text-dark-300 text-base">₦</Text>
            <TextInput className="flex-1 text-fg px-2 py-3.5" placeholder="e.g. 5000" placeholderTextColor="#686868" value={price} onChangeText={setPrice} keyboardType="numeric" maxLength={9} accessibilityLabel="Appointment price in Naira" />
          </View>
          <Text className="text-dark-300 text-sm mt-4 mb-2">Appointment length</Text>
          <View className="flex-row flex-wrap gap-2">
            {DURATIONS.map((d) => <Chip key={d} label={d < 60 ? `${d} min` : `${d / 60}${d % 60 ? '.5' : ''} hr`} selected={duration === d} onPress={() => setDuration(d)} />)}
          </View>
        </View>

        <View>
          <Text className="text-fg font-bold text-base mb-1">Work location</Text>
          <Text className="text-dark-400 text-xs mb-3">Puts you on the customer map so people nearby can find you. Drop a pin, or enter your postcode and we'll fill in the address.</Text>
          <LocationPicker value={location} onChange={setLocation} onClear={() => setLocation(null)} />
        </View>

        <View className="bg-dark-800 rounded-2xl p-4 border border-dark-700">
          <View className="flex-row items-center">
            <Ionicons name="sparkles" size={16} color="#F1A91F" />
            <Text className="text-fg font-bold text-base ml-2 flex-1">Away assistant</Text>
            <Switch value={awayOn} onValueChange={setAwayOn} trackColor={{ true: '#D4891A', false: '#484848' }} accessibilityLabel="Let Cutty AI reply while you're offline" />
          </View>
          <Text className="text-dark-400 text-xs mt-2 leading-4">
            When you're offline, Cutty AI answers customers in your chats using your profile, appointment price, open times and shop. It only gives information: it can't book, cancel, give discounts or promise anything for you. You'll see everything it said when you're back.
          </Text>
          {awayOn && (
            <View className="mt-4">
              <Text className="text-dark-300 text-sm mb-2">What should it know? (optional)</Text>
              <TextInput
                className="bg-dark-900 text-fg px-4 py-3 rounded-xl border border-dark-700 h-32"
                placeholder={'e.g. I work from Lekki Phase 1, near the roundabout. Please come with hair washed. Lateness over 20 mins may need a new slot. Braiding hair not included.'}
                placeholderTextColor="#686868"
                multiline
                textAlignVertical="top"
                maxLength={2000}
                value={awayNotes}
                onChangeText={setAwayNotes}
              />
            </View>
          )}
        </View>

        <PrimaryButton label="Save profile" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
