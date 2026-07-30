import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { sanityClient, urlFor, formatPrice } from '@/lib/sanity'
import { PRODUCT_BY_SLUG } from '@/lib/queries'
import type { Product } from '@cutty/types'
import { useCartStore } from '@/store/cartStore'
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

export default function ProductDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const { addItem, items } = useCartStore()

  useEffect(() => {
    sanityClient.fetch(PRODUCT_BY_SLUG, { slug }).then(setProduct).finally(() => setLoading(false))
  }, [slug])

  if (loading) return <View className="flex-1 bg-dark-900 items-center justify-center"><ActivityIndicator color="#D4891A" size="large" /></View>
  if (!product) return <View className="flex-1 bg-dark-900 items-center justify-center"><Text className="text-dark-400">Product not found</Text></View>

  const inCart = items.find((i) => i.product._id === product._id)
  const cartQty = inCart?.quantity || 0
  const discount = product.compareAtPrice ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0

  function handleAddToCart() {
    addItem(product!, quantity)
    router.push('/cart')
  }

  return (
    <View className="flex-1 bg-dark-900">
      <ScrollView>
        {/* Images */}
        <View className="relative">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {(product.images?.length ? product.images : [null]).map((img, i) => (
              <View key={i} style={{ width }}>
                {img ? (
                  <Image source={{ uri: urlFor(img).width(width).height(400).url() }} style={{ width, height: 400 }} contentFit="cover" />
                ) : (
                  <View style={{ width, height: 400 }} className="bg-dark-800 items-center justify-center">
                    <Ionicons name="image-outline" size={64} color="#484848" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity className="absolute top-14 left-5 w-10 h-10 bg-black/50 rounded-full items-center justify-center" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>

          {discount > 0 && (
            <View className="absolute top-14 right-5 bg-red-500 px-3 py-1 rounded-full">
              <Text className="text-white font-bold">{discount}% OFF</Text>
            </View>
          )}

          {(product.images?.length || 0) > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
              {product.images!.map((_, i) => (
                <View key={i} className={`h-2 rounded-full ${i === activeImage ? 'bg-primary-500 w-6' : 'bg-white/50 w-2'}`} />
              ))}
            </View>
          )}
        </View>

        <View className="p-5 gap-4">
          {/* Product Info */}
          <View>
            {product.category && <Text className="text-primary-400 text-sm font-medium">{product.category.name}</Text>}
            <Text className="text-white text-2xl font-bold mt-1">{product.name}</Text>
            {product.tags && <Text className="text-dark-400 text-sm mt-1">{product.tags.join(' · ')}</Text>}
          </View>

          {/* Price */}
          <View className="flex-row items-center gap-3">
            <Text className="text-primary-400 text-3xl font-bold">{formatPrice(product.price)}</Text>
            {product.compareAtPrice && (
              <Text className="text-dark-400 text-xl line-through">{formatPrice(product.compareAtPrice)}</Text>
            )}
          </View>

          {/* Points */}
          <View className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-3 flex-row items-center gap-3">
            <Text className="text-primary-400 text-lg">⭐</Text>
            <Text className="text-primary-400">Earn <Text className="font-bold">{product.pointsEarned} points</Text> with this purchase</Text>
          </View>

          {/* Quantity */}
          <View className="flex-row items-center gap-4">
            <Text className="text-dark-300 text-sm">Quantity:</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                className="w-9 h-9 bg-dark-700 rounded-full items-center justify-center"
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={16} color="white" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-bold w-8 text-center">{quantity}</Text>
              <TouchableOpacity
                className="w-9 h-9 bg-dark-700 rounded-full items-center justify-center"
                onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}
              >
                <Ionicons name="add" size={16} color="white" />
              </TouchableOpacity>
            </View>
            <Text className="text-dark-400 text-sm">{product.stock} in stock</Text>
            {cartQty > 0 && <Text className="text-primary-400 text-sm">({cartQty} in cart)</Text>}
          </View>

          {/* Stock Warning */}
          {product.stock <= 5 && product.stock > 0 && (
            <Text className="text-yellow-400 text-sm">⚠️ Only {product.stock} left!</Text>
          )}
        </View>
      </ScrollView>

      {/* Add to Cart */}
      <View className="px-5 py-4 bg-dark-800 border-t border-dark-700">
        <TouchableOpacity
          className={`py-4 rounded-2xl items-center flex-row justify-center gap-3 ${product.stock === 0 ? 'bg-dark-600' : 'bg-primary-500'}`}
          onPress={handleAddToCart}
          disabled={product.stock === 0}
        >
          <Ionicons name="bag-add" size={20} color="white" />
          <Text className="text-white text-lg font-bold">
            {product.stock === 0 ? 'Out of Stock' : `Add to Cart — ${formatPrice(product.price * quantity)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
