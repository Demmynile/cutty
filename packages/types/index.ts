export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentMethod = 'wallet' | 'card' | 'cash' | 'transfer'
export type TransactionType = 'credit' | 'debit'
export type WalletTransactionCategory = 'topup' | 'booking_payment' | 'order_payment' | 'refund' | 'withdrawal' | 'admin_adjust'
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'bonus' | 'adjust'
export type DiscountType = 'percentage' | 'fixed'

export interface SanityImage {
  _type: 'image'
  asset: { _ref: string; _type: 'reference' }
  hotspot?: { x: number; y: number; height: number; width: number }
}

export interface Customer {
  _id: string
  _type: 'customer'
  uid: string
  fullName: string
  email: string
  phone?: string
  avatar?: SanityImage
  walletBalance: number
  loyaltyPoints: number
  totalVisits: number
  tier: LoyaltyTier
  isActive: boolean
  createdAt: string
}

export interface Barber {
  _id: string
  _type: 'barber'
  name: string
  photo?: SanityImage
  bio?: string
  specialties?: string[]
  rating: number
  totalReviews: number
  isAvailable: boolean
  workingHours?: { start: string; end: string }
  workingDays?: string[]
}

export interface Service {
  _id: string
  _type: 'service'
  name: string
  description?: string
  image?: SanityImage
  price: number
  duration: number
  pointsEarned: number
  isActive: boolean
  category?: string
}

export interface Booking {
  _id: string
  _type: 'booking'
  customer: Customer
  barber: Barber
  services: Service[]
  bookingDate: string
  startTime: string
  endTime?: string
  totalAmount: number
  discountAmount: number
  pointsEarned: number
  paymentMethod?: PaymentMethod
  status: BookingStatus
  discountCode?: DiscountCode
  notes?: string
  cancelReason?: string
  review?: string
  rating?: number
  createdAt: string
}

export interface Category {
  _id: string
  _type: 'category'
  name: string
  slug: { current: string }
  image?: SanityImage
  description?: string
}

export interface Product {
  _id: string
  _type: 'product'
  name: string
  slug: { current: string }
  category?: Category
  description?: any[]
  images?: SanityImage[]
  price: number
  compareAtPrice?: number
  stock: number
  sku?: string
  pointsEarned: number
  isFeatured: boolean
  isActive: boolean
  tags?: string[]
}

export interface OrderItem {
  product: Product
  quantity: number
  priceAtOrder: number
  productName: string
}

export interface ShippingAddress {
  fullName: string
  address: string
  city: string
  state: string
  phone: string
}

export interface Order {
  _id: string
  _type: 'order'
  orderNumber: string
  customer: Customer
  items: OrderItem[]
  subtotal: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  pointsEarned: number
  paymentMethod?: string
  paymentReference?: string
  status: OrderStatus
  shippingAddress?: ShippingAddress
  discountCode?: DiscountCode
  notes?: string
  createdAt: string
}

export interface LoyaltyTransaction {
  _id: string
  _type: 'loyaltyTransaction'
  customer: Customer
  type: LoyaltyTransactionType
  points: number
  balanceAfter: number
  description?: string
  source?: string
  referenceId?: string
  createdAt: string
}

export interface WalletTransaction {
  _id: string
  _type: 'walletTransaction'
  customer: Customer
  type: TransactionType
  category?: WalletTransactionCategory
  amount: number
  balanceAfter: number
  description?: string
  referenceId?: string
  paymentReference?: string
  status: 'pending' | 'completed' | 'failed' | 'reversed'
  createdAt: string
}

export interface DiscountCode {
  _id: string
  _type: 'discountCode'
  code: string
  type: DiscountType
  value: number
  maxDiscountAmount?: number
  minOrderAmount: number
  applicableTo: 'booking' | 'order' | 'both'
  pointsCost: number
  customer?: Customer
  maxUses?: number
  usedCount: number
  validFrom?: string
  validUntil?: string
  isActive: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface BookingSlot {
  time: string
  available: boolean
}
