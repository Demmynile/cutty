import { Alert } from 'react-native'
import type { Product } from '@cutty/types'
import { useCartStore } from '@/store/cartStore'

/** Adds to cart, asking first if that means emptying another shop's items. Resolves true when added. */
export function addToCart(product: Product, quantity = 1): Promise<boolean> {
  const cart = useCartStore.getState()
  if (cart.addItem(product, quantity) === 'added') return Promise.resolve(true)
  return new Promise((resolve) => {
    Alert.alert(
      'Start a new cart?',
      `Your cart has items from ${cart.sellerName()}. Each shop checks out separately, so adding this will remove them.`,
      [
        { text: 'Keep my cart', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Start new cart', style: 'destructive', onPress: () => { cart.replaceWith(product, quantity); resolve(true) } },
      ],
    )
  })
}
