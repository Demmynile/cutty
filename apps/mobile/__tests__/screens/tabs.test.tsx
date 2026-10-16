// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOYALTY_REWARDS } from '@cutty/types'
import { router } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { pressAlertButton, renderScreen } from '../helpers/screen'
import { routeApi, sent } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn(), useMessageListener: vi.fn() }))
vi.mock('@/lib/auth', async (orig) => ({ ...(await orig<typeof import('@/lib/auth')>()), clearAuthData: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { useAuthStore } = await import('@/store/authStore')
const { useOnboardingStore } = await import('@/store/onboardingStore')
const { useCartStore } = await import('@/store/cartStore')

const customer = {
  _id: 'c1', fullName: 'Ada Obi', email: 'ada@x.io', tier: 'silver', loyaltyPoints: 1500, totalVisits: 7,
  walletBalance: 1_250_000, preferredCurrency: 'NGN',
} as never

const product = (id: string, over: object = {}) => ({
  _id: id, name: `Product ${id}`, slug: { current: id }, price: 200_000, stock: 10, pointsEarned: 20, images: [], ...over,
})

beforeEach(() => {
  document.body.innerHTML = ''
  useAuthStore.setState({ customer, role: 'customer', isAuthenticated: true, isLoading: false })
  useOnboardingStore.setState({ hydrated: true, completedThisSession: true })
  useCartStore.getState().clearCart()
})

describe('(tabs)/_layout', () => {
  it('shows the six customer tabs', async () => {
    const { default: Tabs } = await import('@/app/(tabs)/_layout')
    const s = await renderScreen(<Tabs />)
    expect([...s.container.querySelectorAll('[data-screen]')].map((e) => e.getAttribute('data-title'))).toEqual(['Home', 'Bookings', 'Shop', 'Rewards', 'AI', 'Profile'])
  })

  it.each([
    ['signed out', { isAuthenticated: false, role: null }, '/(auth)'],
    ['a stylist', { isAuthenticated: true, role: 'stylist' }, '/(pro)'],
  ])('redirects %s', async (_l, state, href) => {
    useAuthStore.setState(state as never)
    const { default: Tabs } = await import('@/app/(tabs)/_layout')
    expect((await renderScreen(<Tabs />)).redirect()).toBe(href)
  })

  it('plays onboarding first', async () => {
    useOnboardingStore.setState({ completedThisSession: false })
    const { default: Tabs } = await import('@/app/(tabs)/_layout')
    expect((await renderScreen(<Tabs />)).redirect()).toBe('/onboarding')
  })
})

describe('(tabs)/index (home)', () => {
  beforeEach(() => {
    routeApi(api, {
      'GET /api/v1/catalog/products?featured=1': [product('gel', { compareAtPrice: 250_000 })],
      'GET /api/v1/bookings': [
        { _id: 'b-done', status: 'completed', bookingDate: '2026-01-01', startTime: '09:00' },
        { _id: 'b-next', status: 'confirmed', bookingDate: '2026-07-01', startTime: '10:30', barber: { name: 'Tunde' } },
      ],
      'GET /api/v1/recommendations': { personalized: true, query: 'braids', stylists: [{ reason: 'Knotless ₦25k', stylist: { _id: 'st1', name: 'Ada', rating: 4.8 } }], products: [] },
    })
  })

  it('greets the customer and shows wallet, tier, next booking, search, picks and products', async () => {
    const { default: Home } = await import('@/app/(tabs)/index')
    const s = await renderScreen(<Home />)
    for (const t of ['Ada', '₦12,500', 'silver Member', '1500 points available', '2026-07-01', '10:30 with Tunde', 'Find a barber or stylist near you', 'Near you', 'See stylists around you', 'Recommended for you', 'Based on “braids”', '★ 4.8', 'Product gel', '₦2,500']) {
      expect(s.text()).toContain(t)
    }
  })

  it('navigates to the main destinations', async () => {
    const { default: Home } = await import('@/app/(tabs)/index')
    const s = await renderScreen(<Home />)
    await s.press('2026-07-01')
    expect(router.push).toHaveBeenCalledWith('/booking/b-next')
    await s.press('Book an Appointment')
    expect(router.push).toHaveBeenCalledWith('/booking/new')
    await s.press('Ask Cutty AI')
    expect(router.push).toHaveBeenCalledWith('/ai/search')
    await s.press('Find a barber or stylist near you')
    expect(router.push).toHaveBeenCalledWith('/explore?focus=1')
    await s.press('See map')
    expect(router.push).toHaveBeenCalledWith('/explore')
    await s.press('Wallet Balance')
    expect(router.push).toHaveBeenCalledWith('/wallet')
    await s.press(s.iconButton('chatbubbles-outline'))
    expect(router.push).toHaveBeenCalledWith('/messages')
    await s.press('Knotless ₦25k')
    expect(router.push).toHaveBeenCalledWith('/stylist/st1')
    await s.press('Product gel')
    expect(router.push).toHaveBeenCalledWith('/product/gel')
  })

  it('shows top stylists for customers who have not searched, and survives a failed recommendations call', async () => {
    routeApi(api, {
      'GET /api/v1/catalog/products?featured=1': [],
      'GET /api/v1/bookings': [],
      'GET /api/v1/recommendations': { personalized: false, stylists: [{ reason: 'Top rated', stylist: { _id: 'st1', name: 'Ada' } }], products: [] },
    })
    const { default: Home } = await import('@/app/(tabs)/index')
    const s = await renderScreen(<Home />)
    expect(s.text()).toContain('Top stylists')
    expect(s.text()).not.toContain('UPCOMING APPOINTMENT')
    expect(s.text()).toContain('New')
  })
})

describe('(tabs)/ai', () => {
  it.each([
    ['Find a Stylist', '/ai/search'],
    ['Styling Assistant', '/ai/chat/styling'],
    ['Hair Analysis', '/ai/analyze'],
    ['Virtual Try-On', '/ai/tryon'],
    ['Grooming & Care Guide', '/ai/chat/grooming'],
  ])('%s opens %s', async (title, href) => {
    const { default: AI } = await import('@/app/(tabs)/ai')
    const s = await renderScreen(<AI />)
    await s.press(title)
    expect(router.push).toHaveBeenCalledWith(href)
  })
})

describe('(tabs)/bookings', () => {
  const bookings = [
    { _id: 'b1', status: 'pending', bookingDate: '2026-07-01', startTime: '10:00', totalAmount: 500_000, pointsEarned: 50, barber: { name: 'Tunde' }, style: 'skin-fade' },
    { _id: 'b2', status: 'cancelled', bookingDate: '2026-06-01', startTime: '12:00', totalAmount: 300_000, pointsEarned: 0 },
  ]

  it('lists bookings and filters by status', async () => {
    routeApi(api, { 'GET /api/v1/bookings': bookings })
    const { default: Bookings } = await import('@/app/(tabs)/bookings')
    const s = await renderScreen(<Bookings />)
    expect(s.text()).toContain('10:00 · Tunde')
    expect(s.text()).toContain('Skin Fade')
    expect(s.text()).toContain('⭐ 50 points earned')
    expect(s.text()).toContain('2026-06-01')
    await s.press(/^cancelled$/)
    expect(s.text()).not.toContain('2026-07-01')
    await s.press(/^confirmed$/)
    expect(s.text()).toContain('No bookings yet')
    await s.press('Book Now')
    expect(router.push).toHaveBeenCalledWith('/booking/new')
  })

  it('opens a booking and starts a new one', async () => {
    routeApi(api, { 'GET /api/v1/bookings': bookings })
    const { default: Bookings } = await import('@/app/(tabs)/bookings')
    const s = await renderScreen(<Bookings />)
    await s.press('10:00 · Tunde')
    expect(router.push).toHaveBeenCalledWith('/booking/b1')
    await s.press(/^New$/)
    expect(router.push).toHaveBeenCalledWith('/booking/new')
  })
})

describe('(tabs)/loyalty', () => {
  const reward = LOYALTY_REWARDS[0]

  it('shows points, tier progress and history', async () => {
    routeApi(api, { 'GET /api/v1/loyalty/transactions': [
      { _id: 't1', type: 'earn', points: 50, description: 'Points earned from booking', createdAt: '2026-06-01T00:00:00Z' },
      { _id: 't2', type: 'redeem', points: -500, createdAt: '2026-06-02T00:00:00Z' },
    ] })
    const { default: Loyalty } = await import('@/app/(tabs)/loyalty')
    const s = await renderScreen(<Loyalty />)
    expect(s.text()).toContain('1,500')
    expect(s.text()).toContain('8 more visits to reach Gold')
    expect(s.text()).toContain('+50 pts')
    expect(s.text()).toContain('-500 pts')
    expect(s.text()).toContain('redeem')
  })

  it('redeems a reward and shows the code', async () => {
    routeApi(api, {
      'GET /api/v1/loyalty/transactions': [],
      'POST /api/v1/loyalty/redeem': { code: 'CUTTY-ABC', loyaltyPoints: 1500 - reward.points },
    })
    const { default: Loyalty } = await import('@/app/(tabs)/loyalty')
    const s = await renderScreen(<Loyalty />)
    expect(s.text()).toContain('No transactions yet')
    await s.press('Redeem Points')
    expect(s.container.querySelector('[role=dialog]')).not.toBeNull()
    await s.press(reward.label)
    expect(sent(api, 'POST /api/v1/loyalty/redeem')).toEqual([{ rewardId: reward.id }])
    expect(Alert.alert).toHaveBeenCalledWith('Redeemed! 🎉', expect.stringContaining('CUTTY-ABC'))
    expect(useAuthStore.getState().customer!.loyaltyPoints).toBe(1500 - reward.points)
    expect(s.container.querySelector('[role=dialog]')).toBeNull()
  })

  it('disables rewards the customer cannot afford and reports server errors', async () => {
    useAuthStore.setState({ customer: { ...(customer as object), loyaltyPoints: 0 } as never })
    routeApi(api, { 'GET /api/v1/loyalty/transactions': [] })
    const { default: Loyalty } = await import('@/app/(tabs)/loyalty')
    const s = await renderScreen(<Loyalty />)
    await s.press('Redeem Points')
    expect(s.button(reward.label).disabled).toBe(true)

    useAuthStore.setState({ customer })
    routeApi(api, { 'GET /api/v1/loyalty/transactions': [], 'POST /api/v1/loyalty/redeem': new ApiError(400, 'You need more points.') })
    const t = await renderScreen(<Loyalty />)
    await t.press('Redeem Points')
    await t.press(reward.label)
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'You need more points.')
  })
})

describe('(tabs)/profile', () => {
  it('shows the customer, stats and menu links', async () => {
    const { default: Profile } = await import('@/app/(tabs)/profile')
    const s = await renderScreen(<Profile />)
    for (const t of ['Ada Obi', 'ada@x.io', 'silver Member', '7Visits', '1500Points', '₦12,500Balance']) expect(s.text()).toContain(t)
    for (const [label, route] of [['My Orders', '/orders'], ['Find a Stylist', '/stylists'], ['Settings', '/settings'], ['Help & Support', '/support'], ['Top Up Wallet', '/wallet']]) {
      await s.press(label)
      expect(router.push).toHaveBeenLastCalledWith(route)
    }
    await s.press(s.iconButton('pencil-outline'))
    expect(router.push).toHaveBeenLastCalledWith('/edit-profile')
  })

  it('confirms before signing out', async () => {
    const { default: Profile } = await import('@/app/(tabs)/profile')
    const s = await renderScreen(<Profile />)
    await s.press('Sign Out')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    await pressAlertButton(vi.mocked(Alert.alert), 'Sign Out')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('(tabs)/shop', () => {
  beforeEach(() => {
    routeApi(api, {
      'GET /api/v1/catalog/products': [
        product('gel', { category: { _id: 'cat-hair', name: 'Hair' }, compareAtPrice: 400_000 }),
        product('comb', { category: { _id: 'cat-tools', name: 'Tools' }, stock: 3 }),
        product('oil', { stock: 0, seller: { _id: 'st1', name: 'Ada Hair' } }),
      ],
      'GET /api/v1/catalog/categories': [{ _id: 'cat-hair', name: 'Hair' }, { _id: 'cat-tools', name: 'Tools' }],
    })
  })

  it('shows products with discounts, stock badges and sellers', async () => {
    const { default: Shop } = await import('@/app/(tabs)/shop')
    const s = await renderScreen(<Shop />)
    expect(s.text()).toContain('-50%')
    expect(s.text()).toContain('3 left')
    expect(s.text()).toContain('Out of Stock')
    expect(s.text()).toContain('ADA HAIR')
  })

  it('filters by category and search', async () => {
    const { default: Shop } = await import('@/app/(tabs)/shop')
    const s = await renderScreen(<Shop />)
    await s.press(/^Tools$/)
    expect(s.text()).toContain('Product comb')
    expect(s.text()).not.toContain('Product gel')
    await s.press(/^All$/)
    await s.type('Search products...', 'GEL')
    expect(s.text()).toContain('Product gel')
    expect(s.text()).not.toContain('Product comb')
    await s.type('Search products...', 'nothing matches')
    expect(s.text()).toContain('No products found')
  })

  it('adds to cart without opening the product, and shows the cart count', async () => {
    const { default: Shop } = await import('@/app/(tabs)/shop')
    const s = await renderScreen(<Shop />)
    const addButtons = [...s.container.querySelectorAll('i[data-icon="add"]')].map((i) => i.closest('button')!)
    await s.press(addButtons[0])
    expect(useCartStore.getState().items.map((i) => i.product._id)).toEqual(['gel'])
    expect(router.push).not.toHaveBeenCalledWith('/product/gel')
    expect(addButtons[2].disabled).toBe(true)
    await s.press('Product comb')
    expect(router.push).toHaveBeenCalledWith('/product/comb')
    await s.press(s.iconButton('bag-outline'))
    expect(router.push).toHaveBeenCalledWith('/cart')
  })
})
