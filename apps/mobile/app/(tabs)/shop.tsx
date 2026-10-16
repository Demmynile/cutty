import { memo, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, FlatList } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { Product } from '@cutty/types'
import { imageUri } from '@/lib/sanity'
import { useCategories, useProducts, usePullToRefresh } from '@/lib/data'
import { useCartStore } from '@/store/cartStore'
import { addToCart } from '@/lib/cart'
import { Ionicons } from '@expo/vector-icons'
import { useFormatPrice } from '@/lib/currency'
import { withShop } from '@/lib/features'

const ProductCard = memo(function ProductCard({ product, formatPrice }: { product: Product; formatPrice: (kobo: number) => string }) {
  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0
  const lowStock = product.stock > 0 && product.stock <= 5
  const outOfStock = product.stock === 0

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden"
      style={{ width: '48%' }}
      onPress={() => router.push(`/product/${product.slug.current}`)}
    >
      <View className="relative">
        {product.images?.[0] ? (
          <Image
            source={{ uri: imageUri(product.images[0], 400, 320) }}
            className="w-full h-40"
            contentFit="cover"
            transition={250}
            cachePolicy="memory-disk"
            recyclingKey={product._id}
          />
        ) : (
          <View className="w-full h-40 bg-dark-700 items-center justify-center">
            <Ionicons name="image-outline" size={32} className="text-dark-600" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(26,26,26,0.5)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 }}
          pointerEvents="none"
        />
        {discountPct > 0 && (
          <View className="absolute top-2 left-2 bg-red-500 px-2 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold">-{discountPct}%</Text>
          </View>
        )}
        {lowStock && !outOfStock && (
          <View className="absolute top-2 right-2 bg-dark-900/90 px-2 py-1 rounded-full">
            <Text className="text-primary-300 text-[10px] font-semibold">{product.stock} left</Text>
          </View>
        )}
        {outOfStock && (
          <View className="absolute inset-0 bg-black/70 items-center justify-center">
            <Text className="text-white font-semibold text-xs">Out of Stock</Text>
          </View>
        )}
      </View>
      <View className="p-3.5">
        {(product.seller?.name || product.category?.name) && (
          <Text
            className={`text-[10px] font-semibold mb-1 ${product.seller ? 'text-primary-400' : 'text-dark-400'}`}
            style={{ letterSpacing: 1 }}
            numberOfLines={1}
          >
            {(product.seller?.name ?? product.category!.name).toUpperCase()}
          </Text>
        )}
        <Text className="text-fg text-sm font-semibold leading-[18px]" style={{ minHeight: 36 }} numberOfLines={2}>
          {product.name}
        </Text>
        <View className="flex-row items-baseline gap-2 mt-2 flex-wrap">
          <Text className="text-primary-400 font-bold text-base">{formatPrice(product.price)}</Text>
          {product.compareAtPrice && (
            <Text className="text-dark-500 text-xs line-through">{formatPrice(product.compareAtPrice)}</Text>
          )}
        </View>
        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center gap-1 bg-primary-500/10 px-2 py-1 rounded-full">
            <Ionicons name="star" size={10} color="#F1A91F" />
            <Text className="text-primary-400 text-[10px] font-semibold">+{product.pointsEarned} pts</Text>
          </View>
          <TouchableOpacity
            className={`w-8 h-8 rounded-full items-center justify-center ${outOfStock ? 'bg-dark-700' : 'bg-primary-500'}`}
            onPress={(e) => { e.stopPropagation(); addToCart(product) }}
            disabled={outOfStock}
          >
            <Ionicons name="add" size={16} color={outOfStock ? '#686868' : 'white'} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
})

function ShopScreen() {
  const formatPrice = useFormatPrice()
  const productsQ = useProducts()
  const { data: categories = [], refetch: refetchCategories } = useCategories()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))
  const { refreshing, onRefresh } = usePullToRefresh(productsQ.refetch, refetchCategories)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (productsQ.data ?? []).filter((p) =>
      (activeCategory === 'all' || p.category?._id === activeCategory) && p.name.toLowerCase().includes(q),
    )
  }, [productsQ.data, activeCategory, search])

  return (
    <View className="flex-1 bg-dark-900">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-fg text-2xl font-bold">Shop</Text>
          <TouchableOpacity className="relative" onPress={() => router.push('/cart')}>
            <Ionicons name="bag-outline" size={26} className="text-fg" />
            {itemCount > 0 && (
              <View className="absolute -top-2 -right-2 bg-primary-500 w-5 h-5 rounded-full items-center justify-center">
                <Text className="text-white text-xs font-bold">{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="bg-dark-700 flex-row items-center px-4 py-3 rounded-xl gap-3 mb-4">
          <Ionicons name="search" size={18} className="text-dark-500" />
          <TextInput
            className="flex-1 text-fg text-sm"
            placeholder="Search products..."
            placeholderTextColor="#686868"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ _id: 'all', name: 'All' }, ...categories].map((cat) => (
            <TouchableOpacity
              key={cat._id}
              className={`px-4 py-2 rounded-full ${activeCategory === cat._id ? 'bg-primary-500' : 'bg-dark-700'}`}
              onPress={() => setActiveCategory(cat._id)}
            >
              <Text className={`text-sm font-medium ${activeCategory === cat._id ? 'text-white' : 'text-dark-300'}`}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {productsQ.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#D4891A" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p._id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ padding: 20, gap: 16 }}
          initialNumToRender={6}
          windowSize={7}
          renderItem={({ item }) => <ProductCard product={item} formatPrice={formatPrice} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4891A" />}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="search-outline" size={48} className="text-dark-600" />
              <Text className="text-dark-400 mt-4">No products found</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// Hidden until the shop launches (v2.0).
export default withShop(ShopScreen)
