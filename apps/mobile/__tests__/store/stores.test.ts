import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Customer, DiscountCode, Product, StylistAccount, StylistPublic } from '@cutty/types'
import AsyncStorage from '../stubs/async-storage'
import { clerk } from '../stubs/clerk-expo'

vi.mock('@/lib/auth', () => ({ clearAuthData: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))
vi.mock('@/lib/api', () => ({ setUnauthorizedHandler: vi.fn() }))

const { useCartStore } = await import('@/store/cartStore')
const { useBookingStore } = await import('@/store/bookingStore')
const { useAIChatStore } = await import('@/store/aiChatStore')
const { useOnboardingStore } = await import('@/store/onboardingStore')
const { useThemeStore } = await import('@/store/themeStore')
const { homeFor, useAuthStore } = await import('@/store/authStore')
const { clearAuthData } = await import('@/lib/auth')
const { disconnectRealtime } = await import('@/lib/realtime')
const { setUnauthorizedHandler } = await import('@/lib/api')

// Captured once at import, before mockReset clears call history.
const unauthorizedHandler = vi.mocked(setUnauthorizedHandler).mock.calls[0]?.[0] as () => void

const product = (id: string, price: number, seller?: { _id: string; name: string }, pointsEarned = 1) =>
  ({ _id: id, name: id, price, pointsEarned, seller }) as unknown as Product
const stylist = (id: string, bookingPrice: number, bookingDuration?: number) =>
  ({ _id: id, name: id, barberId: `b-${id}`, bookingPrice, bookingDuration, styles: [] }) as unknown as StylistPublic
const code = (type: 'percentage' | 'fixed', value: number, maxDiscountAmount?: number) =>
  ({ _id: 'd', code: 'X', type, value, maxDiscountAmount }) as unknown as DiscountCode

describe('cartStore', () => {
  beforeEach(() => useCartStore.getState().clearCart())

  it('adds items, merging quantities of the same product', () => {
    const cart = useCartStore.getState()
    expect(cart.addItem(product('p1', 1000))).toBe('added')
    cart.addItem(product('p1', 1000), 2)
    cart.addItem(product('p2', 500), 1)
    expect(useCartStore.getState().items.map((i) => [i.product._id, i.quantity])).toEqual([['p1', 3], ['p2', 1]])
    expect(cart.itemCount()).toBe(4)
    expect(cart.subtotal()).toBe(3500)
    expect(cart.totalPoints()).toBe(4)
  })

  it("refuses another shop's product (one seller per order) and can replace the cart", () => {
    const cart = useCartStore.getState()
    cart.addItem(product('p1', 1000))
    cart.setDiscountCode(code('fixed', 100))
    expect(cart.sellerId()).toBeNull()
    expect(cart.sellerName()).toBe('Cutty')
    expect(cart.addItem(product('s1', 900, { _id: 'st1', name: 'Ada Hair' }))).toBe('conflict')
    expect(useCartStore.getState().items).toHaveLength(1)

    cart.replaceWith(product('s1', 900, { _id: 'st1', name: 'Ada Hair' }), 2)
    expect(useCartStore.getState().items).toEqual([{ product: expect.objectContaining({ _id: 's1' }), quantity: 2 }])
    expect(useCartStore.getState().discountCode).toBeNull()
    expect(cart.sellerId()).toBe('st1')
    expect(cart.sellerName()).toBe('Ada Hair')
  })

  it('updates and removes quantities; zero removes the item', () => {
    const cart = useCartStore.getState()
    cart.addItem(product('p1', 1000))
    cart.addItem(product('p2', 1000))
    cart.updateQuantity('p1', 5)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
    cart.updateQuantity('p1', 0)
    expect(useCartStore.getState().items.map((i) => i.product._id)).toEqual(['p2'])
    cart.removeItem('p2')
    expect(useCartStore.getState().items).toEqual([])
  })

  it('computes percentage (capped) and fixed discounts like the server', () => {
    const cart = useCartStore.getState()
    cart.addItem(product('p1', 10_000), 3)
    cart.setDiscountCode(code('percentage', 15))
    expect(cart.discount()).toBe(4_500)
    cart.setDiscountCode(code('percentage', 50, 2_000))
    expect(cart.discount()).toBe(2_000)
    expect(cart.total()).toBe(28_000)
    cart.setDiscountCode(code('fixed', 100_000))
    expect(cart.discount()).toBe(30_000)
    expect(cart.total()).toBe(0)
    cart.setDiscountCode(null)
    expect(cart.discount()).toBe(0)
  })
})

describe('bookingStore', () => {
  beforeEach(() => useBookingStore.getState().resetDraft())

  it("prices from the chosen stylist and starts over when the stylist changes", () => {
    const b = useBookingStore.getState()
    expect([b.totalAmount(), b.totalDuration(), b.totalPoints()]).toEqual([0, 60, 0])
    b.setStylist(stylist('st1', 750_000, 90))
    expect([b.totalAmount(), b.totalDuration(), b.totalPoints()]).toEqual([750_000, 90, 75])
    b.setStyle('taper-fade')
    b.setDate('2026-06-15')
    b.setStylist(stylist('st1', 750_000, 90)) // same stylist refreshed: keep choices
    expect(useBookingStore.getState().draft).toMatchObject({ style: 'taper-fade', date: '2026-06-15' })
    b.setStylist(stylist('st2', 100_000))
    expect(useBookingStore.getState().draft).toMatchObject({ style: null, date: null })
    expect(b.totalDuration()).toBe(60) // default length
  })

  it('clears the chosen time when the date changes', () => {
    const b = useBookingStore.getState()
    b.setDate('2026-06-15')
    b.setTime('10:00')
    b.setNotes('Fade')
    expect(useBookingStore.getState().draft).toMatchObject({ date: '2026-06-15', time: '10:00', notes: 'Fade' })
    b.setDate('2026-06-16')
    expect(useBookingStore.getState().draft.time).toBeNull()
  })

  it('applies discounts and resets the draft', () => {
    const b = useBookingStore.getState()
    b.setStylist(stylist('st1', 10_000))
    b.setDiscountCode(code('percentage', 10))
    expect(b.discount()).toBe(1_000)
    expect(b.finalAmount()).toBe(9_000)
    b.setDiscountCode(code('percentage', 90, 500))
    expect(b.discount()).toBe(500)
    b.setDiscountCode(code('fixed', 50_000))
    expect(b.finalAmount()).toBe(0)
    b.resetDraft()
    expect(useBookingStore.getState().draft).toEqual({ stylist: null, style: null, date: null, time: null, notes: '', discountCode: null })
  })
})

describe('aiChatStore', () => {
  it('keeps separate histories per mode and persists them', async () => {
    const s = useAIChatStore.getState()
    s.clearAll()
    s.addMessage('styling', { role: 'user', content: 'hi' } as never)
    s.addMessage('grooming', { role: 'user', content: 'yo' } as never)
    s.addMessage('styling', { role: 'assistant', content: 'hello' } as never)
    expect(useAIChatStore.getState().history.styling).toHaveLength(2)
    s.clearMode('styling')
    expect(useAIChatStore.getState().history).toEqual({ styling: [], grooming: [{ role: 'user', content: 'yo' }] })
    await Promise.resolve()
    expect(JSON.parse(AsyncStorage.data.get('cutty-ai-chat')!).state.history.grooming).toHaveLength(1)
  })
})

describe('onboardingStore', () => {
  it('persists only "seen", so the slideshow replays each cold start', () => {
    useOnboardingStore.getState().markSeen()
    expect(useOnboardingStore.getState()).toMatchObject({ seen: true, completedThisSession: true })
    expect(JSON.parse(AsyncStorage.data.get('cutty-onboarding')!).state).toEqual({ seen: true })
  })
})

describe('themeStore', () => {
  it('defaults to dark and persists the mode', () => {
    expect(useThemeStore.getState().mode).toBe('dark')
    useThemeStore.getState().setMode('system')
    expect(JSON.parse(AsyncStorage.data.get('cutty-theme')!).state.mode).toBe('system')
  })
})

describe('authStore', () => {
  const customer = { _id: 'c1', fullName: 'Ada', preferredCurrency: 'NGN' } as Customer
  const stylist = { _id: 's1' } as StylistAccount

  beforeEach(() => {
    useAuthStore.setState({ role: null, customer: null, stylist: null, isAuthenticated: false, isLoading: true })
    clerk.session = null
  })

  it('holds one account at a time', () => {
    const s = useAuthStore.getState()
    s.setCustomer(customer)
    expect(useAuthStore.getState()).toMatchObject({ role: 'customer', customer, stylist: null, isAuthenticated: true, isLoading: false })
    s.setStylist(stylist)
    expect(useAuthStore.getState()).toMatchObject({ role: 'stylist', stylist, customer: null, isAuthenticated: true })
    s.setStylist(null)
    expect(useAuthStore.getState()).toMatchObject({ role: null, isAuthenticated: false })
  })

  it('updates only an existing customer', () => {
    useAuthStore.getState().updateCustomer({ fullName: 'X' })
    expect(useAuthStore.getState().customer).toBeNull()
    useAuthStore.getState().setCustomer(customer)
    useAuthStore.getState().updateCustomer({ fullName: 'Ada Obi' })
    expect(useAuthStore.getState().customer).toMatchObject({ _id: 'c1', fullName: 'Ada Obi' })
  })

  it('persists the account but not loading flags', () => {
    useAuthStore.getState().setCustomer(customer)
    const persisted = JSON.parse(AsyncStorage.data.get('cutty-auth')!).state
    expect(Object.keys(persisted).sort()).toEqual(['customer', 'isAuthenticated', 'role', 'stylist'])
  })

  it('signOut disconnects chat, clears Clerk data and the account', async () => {
    useAuthStore.getState().setCustomer(customer)
    await useAuthStore.getState().signOut()
    expect(disconnectRealtime).toHaveBeenCalled()
    expect(clearAuthData).toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({ customer: null, role: null, isAuthenticated: false })
  })

  it('homeFor routes stylists to Cutty Pro', () => {
    expect(homeFor('stylist')).toBe('/(pro)')
    expect(homeFor('customer')).toBe('/(tabs)')
    expect(homeFor(null)).toBe('/(tabs)')
  })

  it('a 401 signs out only once the Clerk session is really gone', async () => {
    expect(unauthorizedHandler).toBeTypeOf('function')
    useAuthStore.getState().setCustomer(customer)
    clerk.session = { getToken: async () => 't' }
    unauthorizedHandler()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    clerk.session = null
    unauthorizedHandler()
    await vi.waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
  })
})
