import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { api, errorMessage } from '@/lib/api'
import { imageUri } from '@/lib/sanity'
import { invalidate, keys, useCategories, useProProducts } from '@/lib/data'
import { pickFromLibrary, captureFromCamera } from '@/lib/imagePrep'
import { uploadProImage } from '@/lib/uploads'
import { Chip, Loading, PrimaryButton, ScreenHeader, SecondaryButton } from '@/components/ui'
import { withShop } from '@/lib/features'

type Img = { assetId: string; uri: string }

const naira = (kobo?: number) => (kobo == null ? '' : String(kobo / 100))
const toKobo = (v: string) => Math.round(Number(v.replace(/,/g, '')) * 100)

// Create or edit a product in the stylist's shop. Images upload as soon as
// they are picked; the product only references uploaded asset ids.
function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { data: categories = [] } = useCategories()
  // Editing: the product comes from the shop's cached product list.
  const productsQ = useProProducts(!!id)
  const [loaded, setLoaded] = useState(!id)
  const loading = !loaded
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [stock, setStock] = useState('10')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [images, setImages] = useState<Img[]>([])
  const [isActive, setIsActive] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || loaded || productsQ.isLoading) return
    Promise.resolve(productsQ.error ? Promise.reject(productsQ.error) : productsQ.data ?? [])
      .then((list) => {
        const p = list.find((x) => x._id === id)
        if (!p) throw new Error('Product not found')
        setName(p.name)
        setPrice(naira(p.price))
        setCompareAt(naira(p.compareAtPrice))
        setStock(String(p.stock ?? 0))
        setCategoryId(p.category?._id ?? null)
        const blocks = (p.description ?? []) as Array<{ children?: Array<{ text?: string }> }>
        setDescription(blocks.map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).join('\n\n'))
        setTags((p.tags ?? []).join(', '))
        setImages((p.images ?? []).map((img) => ({ assetId: img.asset._ref, uri: imageUri(img, 192, 192) })))
        setIsActive(p.isActive !== false)
      })
      .catch((err) => Alert.alert('Product', errorMessage(err, 'Could not load this product.'), [{ text: 'OK', onPress: () => router.back() }]))
      .finally(() => setLoaded(true))
  }, [id, loaded, productsQ.isLoading, productsQ.data, productsQ.error])

  function addImage() {
    const take = (fn: typeof pickFromLibrary) => async () => {
      try {
        const picked = await fn()
        if (!picked) return
        setUploading(true)
        const assetId = await uploadProImage(picked, 'product')
        setImages((list) => [...list, { assetId, uri: picked.uri }])
      } catch (err) {
        Alert.alert('Photo', err instanceof Error ? err.message : errorMessage(err))
      } finally {
        setUploading(false)
      }
    }
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: take(captureFromCamera) },
      { text: 'Choose from library', onPress: take(pickFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function save() {
    const priceKobo = toKobo(price)
    const compareKobo = compareAt.trim() ? toKobo(compareAt) : null
    const stockNum = Number(stock)
    if (name.trim().length < 2) return Alert.alert('Name', 'Give the product a name.')
    if (!Number.isFinite(priceKobo) || priceKobo < 100) return Alert.alert('Price', 'Enter a price of at least ₦1.')
    if (compareKobo !== null && (!Number.isFinite(compareKobo) || compareKobo <= priceKobo)) return Alert.alert('Original price', 'The original price must be higher than the selling price, or leave it empty.')
    if (!Number.isInteger(stockNum) || stockNum < 0) return Alert.alert('Stock', 'Enter how many you have, e.g. 10.')

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        price: priceKobo,
        compareAtPrice: compareKobo,
        stock: stockNum,
        categoryId,
        description: description.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 15),
        imageAssetIds: images.map((i) => i.assetId),
        isActive,
      }
      if (id) await api('PATCH', `/api/v1/pro/products/${id}`, body)
      else await api('POST', '/api/v1/pro/products', body)
      invalidate(keys.pro.products, keys.products)
      router.back()
    } catch (err) {
      Alert.alert('Not saved', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <KeyboardAvoidingView className="flex-1 bg-dark-900" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={id ? 'Edit product' : 'New product'} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="text-dark-300 text-sm mb-2">Photos ({images.length}/6)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {images.map((img, i) => (
              <View key={img.assetId}>
                <Image source={{ uri: img.uri }} style={{ width: 96, height: 96, borderRadius: 12 }} contentFit="cover" />
                <TouchableOpacity onPress={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/60 rounded-full p-1" accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 6 && (
              <TouchableOpacity onPress={addImage} disabled={uploading} className="w-24 h-24 rounded-xl bg-dark-800 border border-dashed border-dark-600 items-center justify-center">
                {uploading ? <ActivityIndicator color="#D4891A" /> : <Ionicons name="camera-outline" size={26} color="#888888" />}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View>
          <Text className="text-dark-300 text-sm mb-2">Name</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" placeholder="e.g. Rosemary growth oil, 100ml" placeholderTextColor="#686868" value={name} onChangeText={setName} maxLength={100} />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-dark-300 text-sm mb-2">Price (₦)</Text>
            <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" keyboardType="decimal-pad" placeholder="4500" placeholderTextColor="#686868" value={price} onChangeText={setPrice} />
          </View>
          <View className="flex-1">
            <Text className="text-dark-300 text-sm mb-2">Original price (₦)</Text>
            <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor="#686868" value={compareAt} onChangeText={setCompareAt} />
          </View>
          <View style={{ width: 80 }}>
            <Text className="text-dark-300 text-sm mb-2">Stock</Text>
            <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" keyboardType="number-pad" value={stock} onChangeText={setStock} />
          </View>
        </View>

        {categories.length > 0 && (
          <View>
            <Text className="text-dark-300 text-sm mb-2">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map((c) => <Chip key={c._id} label={c.name} selected={categoryId === c._id} onPress={() => setCategoryId(categoryId === c._id ? null : c._id)} />)}
            </View>
          </View>
        )}

        <View>
          <Text className="text-dark-300 text-sm mb-2">Description</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700 h-28" multiline textAlignVertical="top" placeholder="What it does, who it's for, how to use it." placeholderTextColor="#686868" value={description} onChangeText={setDescription} maxLength={2000} />
        </View>
        <View>
          <Text className="text-dark-300 text-sm mb-2">Tags</Text>
          <TextInput className="bg-dark-800 text-fg px-4 py-3.5 rounded-xl border border-dark-700" placeholder="natural hair, edges, braids (comma separated)" placeholderTextColor="#686868" value={tags} onChangeText={setTags} />
        </View>

        {id && <SecondaryButton label={isActive ? 'Hide from shop' : 'Show in shop'} icon={isActive ? 'eye-off-outline' : 'eye-outline'} onPress={() => setIsActive(!isActive)} />}
        <PrimaryButton label={id ? 'Save changes' : 'Add product'} onPress={save} loading={saving} disabled={uploading} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Hidden until the shop launches (v2.0).
export default withShop(ProductEditScreen)
