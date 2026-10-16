import { create } from 'zustand'
import type { CartItem, DiscountCode, Product } from '@cutty/types'

interface CartState {
  items: CartItem[]
  discountCode: DiscountCode | null
  /** Returns 'conflict' (and adds nothing) when the cart holds another shop's items. */
  addItem: (product: Product, quantity?: number) => 'added' | 'conflict'
  /** Empties the cart and adds this product (used after the customer confirms switching shops). */
  replaceWith: (product: Product, quantity?: number) => void
  /** null = Cutty's own shop. */
  sellerId: () => string | null
  sellerName: () => string
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setDiscountCode: (code: DiscountCode | null) => void
  subtotal: () => number
  discount: () => number
  total: () => number
  totalPoints: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discountCode: null,

  // One order = one seller (payments split to a single stylist's account), so
  // the cart only ever holds products from one shop.
  addItem: (product, quantity = 1) => {
    const items = get().items
    if (items.length && (items[0].product.seller?._id ?? null) !== (product.seller?._id ?? null)) return 'conflict'
    const existing = items.find((i) => i.product._id === product._id)
    if (existing) {
      set({
        items: items.map((i) =>
          i.product._id === product._id
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        ),
      })
    } else {
      set({ items: [...items, { product, quantity }] })
    }
    return 'added'
  },

  replaceWith: (product, quantity = 1) => set({ items: [{ product, quantity }], discountCode: null }),

  sellerId: () => get().items[0]?.product.seller?._id ?? null,

  sellerName: () => get().items[0]?.product.seller?.name ?? 'Cutty',

  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.product._id !== productId) }),

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set({
      items: get().items.map((i) =>
        i.product._id === productId ? { ...i, quantity } : i,
      ),
    })
  },

  clearCart: () => set({ items: [], discountCode: null }),

  setDiscountCode: (discountCode) => set({ discountCode }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

  discount: () => {
    const code = get().discountCode
    if (!code) return 0
    const sub = get().subtotal()
    if (code.type === 'percentage') {
      const disc = Math.round((sub * code.value) / 100)
      return code.maxDiscountAmount ? Math.min(disc, code.maxDiscountAmount) : disc
    }
    return Math.min(code.value, sub)
  },

  total: () => get().subtotal() - get().discount(),

  totalPoints: () => get().items.reduce((sum, i) => sum + i.product.pointsEarned * i.quantity, 0),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
