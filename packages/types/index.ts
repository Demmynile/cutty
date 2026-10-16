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

export interface PaymentMethodCard {
  _key: string
  brand: 'visa' | 'mastercard' | 'verve' | 'other'
  last4: string
  expiryMonth: number
  expiryYear: number
  holderName: string
  isDefault: boolean
}

export type PreferredLanguage = 'en' | 'fr' | 'yo' | 'ha' | 'ig'
export type PreferredCurrency = 'NGN' | 'USD' | 'GBP'

export interface NotificationPreferences {
  push: boolean
  email: boolean
  sms: boolean
  promos: boolean
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
  paymentMethods?: PaymentMethodCard[]
  preferredLanguage?: PreferredLanguage
  preferredCurrency?: PreferredCurrency
  notificationPreferences?: NotificationPreferences
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
  /** Set when this bookable profile belongs to a Cutty Pro stylist. */
  stylistId?: string
  weeklyAvailability?: AvailabilityWindow[]
  timeOff?: string[]
}

export interface Booking {
  _id: string
  _type: 'booking'
  customer: Customer
  barber: Barber
  /** Style the customer asked for, picked from the stylist's styles. */
  style?: string
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
  /** The stylist shop selling this product; absent for Cutty's own products. */
  seller?: { _id: string; name: string } | null
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
  seller?: { _id: string; name: string } | null
  paidAt?: string
  sellerConfirmedAt?: string
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

export type AIChatMode = 'styling' | 'grooming'

export interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIImageInput {
  base64: string
  mediaType: 'image/jpeg' | 'image/png'
}

export interface AIChatRequest {
  mode: AIChatMode
  messages: AIChatMessage[]
  image?: AIImageInput
}

export interface AIChatResponse {
  reply: string
}

export interface AIAnalyzeRequest {
  image: AIImageInput
  notes?: string
}

export type AIServiceCategory = 'haircut' | 'shave' | 'styling' | 'treatment' | 'combo' | 'braiding' | 'wig'

export interface AIStyleRecommendation {
  style: string
  reasoning: string
  maintenanceTips: string
  matchedServiceCategory?: AIServiceCategory
}

export interface AIAnalyzeResponse {
  faceShapeRead: string
  hairTypeRead: string
  recommendations: AIStyleRecommendation[]
  generalMaintenanceTips: string[]
  disclaimer: string
}

export type AITryOnStyleGender = 'male' | 'female' | 'unisex'

export interface AITryOnStyle {
  id: string
  label: string
  /** One-line description shown under the style name in the app. */
  blurb: string
  /** Instruction fragment handed to the image model describing the cut. */
  prompt: string
  /** Bookable service category this style maps to, for the "Book this" CTA. */
  serviceCategory: AIServiceCategory
  /** Which style-picker section (Men / Women) this style is grouped under; 'unisex' shows in both. */
  gender: AITryOnStyleGender
}

/**
 * Curated hairstyle presets for the Virtual Try-On feature. Shared so the mobile
 * app renders the picker and the API validates `styleId` against the same list.
 */
export const TRY_ON_STYLES: readonly AITryOnStyle[] = [
  {
    id: 'buzz',
    label: 'Buzz Cut',
    blurb: 'Clean, even, low-maintenance',
    prompt: 'a short, even buzz cut roughly a #2 clipper-guard length all over',
    serviceCategory: 'haircut',
    gender: 'male',
  },
  {
    id: 'crew',
    label: 'Crew Cut',
    blurb: 'Short, tidy, classic',
    prompt: 'a classic crew cut, short on the back and sides with a slightly longer, tapered top',
    serviceCategory: 'haircut',
    gender: 'male',
  },
  {
    id: 'taper-fade',
    label: 'Taper Fade',
    blurb: 'Faded sides, textured top',
    prompt: 'a modern taper fade with short faded sides and back blending into two to three inches of textured hair on top styled loosely forward',
    serviceCategory: 'haircut',
    gender: 'male',
  },
  {
    id: 'skin-fade',
    label: 'Skin Fade',
    blurb: 'High-contrast and crisp',
    prompt: 'a high skin fade shaved to the skin low on the sides, blending up into a short textured crop on top, with a clean line-up at the hairline',
    serviceCategory: 'haircut',
    gender: 'male',
  },
  {
    id: 'pompadour',
    label: 'Pompadour',
    blurb: 'Volume swept up and back',
    prompt: 'a pompadour with the top hair grown out and styled up and back off the forehead with height and volume, sides kept short and tapered',
    serviceCategory: 'styling',
    gender: 'male',
  },
  {
    id: 'quiff',
    label: 'Textured Quiff',
    blurb: 'Modern, tousled lift',
    prompt: 'a textured quiff, medium-length on top styled up and forward with a natural matte finish and faded sides',
    serviceCategory: 'styling',
    gender: 'male',
  },
  {
    id: 'slick-back',
    label: 'Slick Back',
    blurb: 'Polished and grown-out',
    prompt: 'medium-length hair combed straight back with a glossy slicked finish and tapered sides',
    serviceCategory: 'styling',
    gender: 'male',
  },
  {
    id: 'curly-top',
    label: 'Curly Top',
    blurb: 'Defined natural curls',
    prompt: 'a curly top with two to three inches of defined natural curls on top and tapered short sides',
    serviceCategory: 'haircut',
    gender: 'unisex',
  },
  {
    id: 'afro',
    label: 'Afro',
    blurb: 'Full, rounded shape',
    prompt: 'a rounded, evenly shaped afro with natural volume and clean edges',
    serviceCategory: 'haircut',
    gender: 'unisex',
  },
  {
    id: 'waves',
    label: '360 Waves',
    blurb: 'Brushed-in wave pattern',
    prompt: 'short hair with a well-defined 360 wave pattern brushed in and radiating from the crown',
    serviceCategory: 'haircut',
    gender: 'male',
  },
  {
    id: 'locs',
    label: 'Locs',
    blurb: 'Neat medium-length locs',
    prompt: 'neat, medium-length locs (dreadlocks) that fall to about the jaw, evenly sectioned',
    serviceCategory: 'styling',
    gender: 'unisex',
  },
  {
    id: 'cornrows',
    label: 'Cornrows',
    blurb: 'Braided straight back',
    prompt: 'cornrows braided in even straight-back rows from the hairline to the nape',
    serviceCategory: 'styling',
    gender: 'unisex',
  },
  {
    id: 'man-bun',
    label: 'Man Bun + Undercut',
    blurb: 'Long on top, tied back',
    prompt: 'long top hair pulled back into a compact man bun at the crown with the sides and back shaved in an undercut',
    serviceCategory: 'styling',
    gender: 'male',
  },
  {
    id: 'curtains',
    label: 'Curtain Fringe',
    blurb: 'Middle-parted, face-framing',
    prompt: 'a middle-parted curtain fringe, medium-length hair parted in the centre and sweeping down on both sides to frame the face',
    serviceCategory: 'styling',
    gender: 'unisex',
  },
  {
    id: 'pixie',
    label: 'Pixie Cut',
    blurb: 'Short and elegant',
    prompt: 'a short pixie cut, cropped close at the back and sides with a slightly longer textured fringe',
    serviceCategory: 'haircut',
    gender: 'female',
  },
  {
    id: 'blunt-bob',
    label: 'Blunt Bob',
    blurb: 'Chin-length and sleek',
    prompt: 'a sleek, blunt bob cut to chin length with a clean straight perimeter',
    serviceCategory: 'haircut',
    gender: 'female',
  },
  {
    id: 'shoulder-layers',
    label: 'Shoulder Layers',
    blurb: 'Soft layered length',
    prompt: 'soft, layered hair falling to the shoulders with face-framing layers and natural movement',
    serviceCategory: 'styling',
    gender: 'female',
  },
  {
    id: 'box-braids',
    label: 'Box Braids',
    blurb: 'Classic, protective, long',
    prompt: 'long, waist-length box braids, neatly parted in even square sections with a natural matte finish',
    serviceCategory: 'braiding',
    gender: 'female',
  },
  {
    id: 'knotless-braids',
    label: 'Knotless Braids',
    blurb: 'Lightweight, seamless start',
    prompt: 'medium-length knotless braids with a seamless, tension-free start at the root and a natural flowing finish',
    serviceCategory: 'braiding',
    gender: 'female',
  },
  {
    id: 'senegalese-twists',
    label: 'Senegalese Twists',
    blurb: 'Smooth, rope-like twists',
    prompt: 'shoulder-length Senegalese twists, smooth and rope-like with a glossy, uniform finish',
    serviceCategory: 'braiding',
    gender: 'female',
  },
  {
    id: 'faux-locs',
    label: 'Faux Locs',
    blurb: 'Textured, boho locs',
    prompt: 'medium-length faux locs with a soft, textured wrap and a few loose curly ends for a bohemian finish',
    serviceCategory: 'braiding',
    gender: 'female',
  },
  {
    id: 'bantu-knots',
    label: 'Bantu Knots',
    blurb: 'Sculpted coiled knots',
    prompt: 'neat rows of sculpted Bantu knots coiled close to the scalp in an even grid pattern',
    serviceCategory: 'braiding',
    gender: 'female',
  },
  {
    id: 'lace-front-wig',
    label: 'Lace Front Wig',
    blurb: 'Straight, natural hairline',
    prompt: 'a sleek, bone-straight lace front wig with a natural-looking hairline and a deep side part',
    serviceCategory: 'wig',
    gender: 'female',
  },
  {
    id: 'bob-wig',
    label: 'Bob Wig',
    blurb: 'Chin-length, full wig',
    prompt: 'a full bob-length wig install, blunt-cut at the chin with a glossy, uniform finish',
    serviceCategory: 'wig',
    gender: 'female',
  },
  {
    id: 'curly-wig',
    label: 'Curly Wig',
    blurb: 'Bouncy, voluminous curls',
    prompt: 'a voluminous curly wig install with bouncy, well-defined curls falling past the shoulders',
    serviceCategory: 'wig',
    gender: 'female',
  },
  {
    id: 'silk-press',
    label: 'Silk Press',
    blurb: 'Sleek, silky blowout',
    prompt: 'a natural hair silk press: sleek, silky, bone-straight hair with a smooth shine and soft bounce at the ends',
    serviceCategory: 'treatment',
    gender: 'female',
  },
]

/** Display name for a stylist style: a try-on preset id maps to its label; custom names show as written. */
export function styleLabel(style: string) {
  return TRY_ON_STYLES.find((s) => s.id === style)?.label ?? style
}

export interface AITryOnRequest {
  image: AIImageInput
  styleId: string
}

export interface AITryOnResponse {
  image: AIImageInput
  styleId: string
  caption: string
}

// ─── Loyalty rewards ──────────────────────────────────────────────────────
// Shared so the app renders the menu and the API (/api/v1/loyalty/redeem)
// enforces cost and value — the client only ever sends a reward id.
export interface LoyaltyReward {
  id: string
  points: number
  label: string
  type: 'fixed' | 'percentage'
  /** kobo for 'fixed', percent for 'percentage' */
  value: number
}

export const LOYALTY_REWARDS: readonly LoyaltyReward[] = [
  { id: 'fixed-500', points: 100, label: '₦500 off next order', type: 'fixed', value: 50000 },
  { id: 'pct-10', points: 200, label: '10% off next booking', type: 'percentage', value: 10 },
  { id: 'fixed-3000', points: 500, label: '₦3,000 off any order', type: 'fixed', value: 300000 },
] as const

// ─── Cutty Pro (stylist accounts) ─────────────────────────────────────────

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export const WEEKDAYS: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export interface AvailabilityWindow {
  _key?: string
  day: Weekday
  /** HH:mm */
  start: string
  /** HH:mm */
  end: string
}

export type StylistKind = 'barber' | 'braider' | 'both'
export type StylistStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type ShopStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'suspended'

export interface StylistShop {
  status: ShopStatus
  name?: string
  description?: string
  bankCode?: string
  bankName?: string
  /** Last 4 digits only — the full number never leaves the server. */
  accountNumberLast4?: string
  accountName?: string
  commissionPercent?: number
  reviewNote?: string
}

/** The signed-in stylist's own account (GET /api/v1/pro/me). */
export interface StylistAccount {
  _id: string
  _type: 'stylist'
  fullName: string
  displayName?: string
  email: string
  phone?: string
  kind: StylistKind
  photo?: SanityImage
  bio?: string
  yearsExperience?: number
  skills: string[]
  styles: string[]
  weeklyAvailability: AvailabilityWindow[]
  timeOff: string[]
  status: StylistStatus
  reviewNote?: string
  barberId?: string
  shop: StylistShop
  rating?: number
  totalReviews?: number
  awayAssistant: AwayAssistantSettings
  location?: StylistLocation
  /** What one appointment costs, in kobo. Customers can't book until it's set. */
  bookingPrice?: number
  /** Length of one appointment in minutes. */
  bookingDuration?: number
  createdAt: string
}

/** Where a stylist works, so customers can find the nearest chair on the map. */
export interface StylistLocation {
  lat: number
  lng: number
  /** Neighbourhood customers recognise, e.g. "Lekki Phase 1". */
  area?: string
  /** Street line, e.g. "12 Admiralty Way". */
  address?: string
  city?: string
  /** State or county. */
  state?: string
  postcode?: string
}

/** Cutty AI answers customers for the stylist while they're offline (text only; it never books, cancels or changes anything). */
export interface AwayAssistantSettings {
  enabled: boolean
  /** Extra facts the stylist wants it to know: location, deposit/cancellation policy, parking, FAQs. */
  notes?: string
}

/** What customers see about a stylist (GET /api/v1/stylists/[id]). */
export interface StylistPublic {
  _id: string
  name: string
  kind: StylistKind
  photo?: SanityImage
  bio?: string
  yearsExperience?: number
  skills: string[]
  styles: string[]
  weeklyAvailability: AvailabilityWindow[]
  rating?: number
  totalReviews?: number
  barberId?: string
  hasShop: boolean
  shopName?: string
  location?: StylistLocation
  /** Straight-line distance from the customer, when the request sent their position. */
  distanceKm?: number
  /** What one appointment costs, in kobo; absent until the stylist sets it. */
  bookingPrice?: number
  bookingDuration?: number
  products?: Product[]
}

export interface StylistDashboard {
  status: StylistStatus
  shopStatus: ShopStatus
  totals: {
    customers: number
    visits: number
    productsSold: number
    revenueBookings: number
    revenueProducts: number
    pendingSales: number
    upcomingBookings: number
    bonusPointsThisMonth: number
    bonusMonthlyCap: number
  }
  upcoming: Array<Pick<Booking, '_id' | 'bookingDate' | 'startTime' | 'status' | 'totalAmount'> & { customerName: string; style?: string }>
  pendingSales: StylistSale[]
}

export interface StylistCustomerStat {
  customerId: string
  name: string
  avatar?: SanityImage
  tier: LoyaltyTier
  visits: number
  productsPurchased: number
  totalSpent: number
  lastVisit?: string
  bonusGiven: number
}

export interface StylistSale {
  _id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod?: string
  totalAmount: number
  createdAt: string
  customerName: string
  items: Array<{ productName: string; quantity: number; priceAtOrder: number }>
  shippingAddress?: ShippingAddress
}

export interface BankOption {
  code: string
  name: string
}

// ─── Customer ↔ stylist chat ──────────────────────────────────────────────

export type ChatSenderType = 'customer' | 'stylist' | 'ai'

export interface ChatMessageDoc {
  _id: string
  conversationId: string
  senderType: ChatSenderType
  senderId?: string
  text: string
  clientId?: string
  createdAt: string
}

export interface ConversationSummary {
  _id: string
  customer: { _id: string; name: string; avatar?: SanityImage }
  stylist: { _id: string; name: string; photo?: SanityImage }
  lastMessageAt?: string
  lastMessagePreview?: string
  unread: number
}

/** Socket.IO events shared by apps/realtime and the mobile app. */
export interface ServerToClientEvents {
  'message:new': (message: ChatMessageDoc) => void
  'conversation:read': (payload: { conversationId: string; by: 'customer' | 'stylist' }) => void
  'typing': (payload: { conversationId: string; by: 'customer' | 'stylist' }) => void
}

export interface ClientToServerEvents {
  'conversation:join': (conversationId: string, ack: (res: { ok: boolean; error?: string }) => void) => void
  'conversation:leave': (conversationId: string) => void
  'message:send': (
    payload: { conversationId: string; text: string; clientId: string },
    ack: (res: { ok: true; message: ChatMessageDoc } | { ok: false; error: string }) => void,
  ) => void
  'conversation:read': (conversationId: string) => void
  'typing': (conversationId: string) => void
}

// ─── AI search & recommendations ──────────────────────────────────────────

export interface AISearchStylistPick {
  stylist: Pick<StylistPublic, '_id' | 'name' | 'kind' | 'photo' | 'rating' | 'skills'>
  reason: string
}

export interface AISearchProductPick {
  product: Pick<Product, '_id' | 'name' | 'slug' | 'images' | 'price' | 'stock'>
  reason: string
}

export interface AISearchResult {
  _id?: string
  query: string
  summary: string
  stylists: AISearchStylistPick[]
  products: AISearchProductPick[]
  /** Try-on preset ids */
  styles: string[]
  createdAt?: string
}

// Features switched off for this release. The code stays in place; flip a flag
// to true to bring the feature back (the shop is planned for v2.0).
export const FEATURES = {
  /** Product shop: customer shop/cart/checkout/orders, stylist shops, admin Products & Orders. */
  shop: false,
} as const
