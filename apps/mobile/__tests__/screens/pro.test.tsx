// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRY_ON_STYLES } from '@cutty/types'
import { router, setParams } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { pressAlertButton, renderScreen } from '../helpers/screen'
import { routeApi, sent } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn(), useMessageListener: vi.fn() }))
vi.mock('@/lib/auth', async (orig) => ({ ...(await orig<typeof import('@/lib/auth')>()), clearAuthData: vi.fn() }))
vi.mock('@/lib/imagePrep', () => ({ captureFromCamera: vi.fn(), pickFromLibrary: vi.fn() }))
vi.mock('@/lib/uploads', () => ({ uploadProImage: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { pickFromLibrary, captureFromCamera } = await import('@/lib/imagePrep')
const { uploadProImage } = await import('@/lib/uploads')
const { useAuthStore } = await import('@/store/authStore')

const alert = vi.mocked(Alert.alert)
const ASSET = 'image-0123456789abcdef0123-640x480-jpg'

function stylist(over: Record<string, unknown> = {}) {
  return {
    _id: 's1', fullName: 'Amaka Obi', email: 'amaka@x.io', phone: '08012345678', kind: 'braider', status: 'approved',
    skills: ['Knotless braids'], styles: ['knotless-braids'], weeklyAvailability: [{ day: 'monday', start: '09:00', end: '17:00' }], timeOff: [],
    shop: { status: 'approved', name: 'Amaka Hair', bankName: 'GTBank', accountNumberLast4: '6789', commissionPercent: 10 },
    awayAssistant: { enabled: false }, rating: 4.8, bookingPrice: 500_000, bookingDuration: 90,
    ...over,
  }
}
const signInAs = (over: Record<string, unknown> = {}) =>
  useAuthStore.setState({ stylist: stylist(over) as never, customer: null, role: 'stylist', isAuthenticated: true, isLoading: false })

beforeEach(() => {
  setParams({})
  signInAs()
})

describe('(pro)/_layout', () => {
  it('shows the five Cutty Pro tabs to stylists', async () => {
    const { default: ProLayout } = await import('@/app/(pro)/_layout')
    const s = await renderScreen(<ProLayout />)
    expect([...s.container.querySelectorAll('[data-screen]')].map((e) => e.getAttribute('data-title'))).toEqual(['Dashboard', 'Schedule', 'Shop', 'Messages', 'Account'])
  })

  it('sends customers and signed-out users elsewhere', async () => {
    const { default: ProLayout } = await import('@/app/(pro)/_layout')
    useAuthStore.setState({ role: 'customer' })
    expect((await renderScreen(<ProLayout />)).redirect()).toBe('/(tabs)')
    useAuthStore.setState({ isAuthenticated: false })
    expect((await renderScreen(<ProLayout />)).redirect()).toBe('/(auth)')
  })
})

describe('(pro)/index (dashboard)', () => {
  const dashboard = {
    status: 'approved', shopStatus: 'approved',
    totals: { customers: 12, visits: 30, productsSold: 7, pendingSales: 1, revenueBookings: 9_000_000, revenueProducts: 1_500_000, bonusPointsThisMonth: 500, bonusMonthlyCap: 2000, upcomingBookings: 1 },
    upcoming: [{ _id: 'b1', bookingDate: '2026-07-04', startTime: '10:00', status: 'confirmed', customerName: 'Kemi', style: 'knotless-braids' }],
    pendingSales: [{ _id: 'o1', orderNumber: 'CUT-1', status: 'paid', customerName: 'Bola', totalAmount: 300_000, items: [{ quantity: 2 }] }],
  }

  function route(me: Record<string, unknown>) {
    routeApi(api, { 'GET /api/v1/pro/me': stylist(me), 'GET /api/v1/pro/dashboard': dashboard })
  }

  it('shows stats, upcoming appointments and sales to confirm', async () => {
    route({ photo: { asset: { _ref: ASSET } }, bio: 'Hi' })
    const { default: Dashboard } = await import('@/app/(pro)/index')
    const s = await renderScreen(<Dashboard />)
    for (const t of ['Hi, Amaka', '12Customers', '30Completed visits', '₦90,000Booking revenue', '500 of 2000 points given', '10:00', 'Kemi', 'Knotless Braids', '#CUT-1', 'Bola · 2 items · ₦3,000']) expect(s.text()).toContain(t)
    expect(s.text()).not.toContain('Finish setting up')
    await s.press('Customers')
    expect(router.push).toHaveBeenCalledWith('/pro/customers')
    await s.press('Schedule →')
    expect(router.push).toHaveBeenCalledWith('/(pro)/schedule')
  })

  it('lists remaining setup steps and the review banner for pending stylists', async () => {
    route({ status: 'pending', skills: [], weeklyAvailability: [], shop: { status: 'none' }, bookingPrice: undefined })
    const { default: Dashboard } = await import('@/app/(pro)/index')
    const s = await renderScreen(<Dashboard />)
    expect(s.text()).toContain('Your profile is under review')
    expect(s.text()).toContain('0 of 4 done')
    await s.press('Set your weekly hours')
    expect(router.push).toHaveBeenCalledWith('/pro/availability')
    await s.press('Set your appointment price')
    expect(router.push).toHaveBeenLastCalledWith('/pro/profile-edit')
  })

  it.each([
    [{ status: 'rejected', reviewNote: 'Add clearer photos' }, 'Add clearer photos', 'Edit profile →', '/pro/profile-edit'],
    [{ shop: { status: 'none' } }, 'Open your own shop', 'Set up shop →', '/pro/shop-setup'],
  ])('shows the right banner for %o', async (me, text, action, route_) => {
    route(me)
    const { default: Dashboard } = await import('@/app/(pro)/index')
    const s = await renderScreen(<Dashboard />)
    expect(s.text()).toContain(text)
    await s.press(action)
    expect(router.push).toHaveBeenCalledWith(route_)
  })
})

describe('(pro)/account', () => {
  it('shows the profile and routes the menu', async () => {
    signInAs({ shop: { status: 'requested' } })
    const { default: Account } = await import('@/app/(pro)/account')
    const s = await renderScreen(<Account />)
    for (const t of ['Amaka Obi', 'amaka@x.io', 'Live', '★ 4.8', '1 skills · 1 styles', '1 days a week', '₦5,000 · 90 min', 'requested']) expect(s.text()).toContain(t)
    for (const [label, route] of [['Profile, skills & styles', '/pro/profile-edit'], ['Availability', '/pro/availability'], ['Appointment price', '/pro/profile-edit'], ['Customers & loyalty bonuses', '/pro/customers'], ['Shop & payouts', '/pro/shop-setup'], ['Change password', '/change-password']]) {
      await s.press(label)
      expect(router.push).toHaveBeenLastCalledWith(route)
    }
  })

  it('opens the shop tab once the shop is approved, and signs out', async () => {
    const { default: Account } = await import('@/app/(pro)/account')
    const s = await renderScreen(<Account />)
    await s.press('Shop & payouts')
    expect(router.push).toHaveBeenLastCalledWith('/(pro)/shop')
    await s.press('Sign Out')
    await pressAlertButton(alert, 'Sign out')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(router.replace).toHaveBeenCalledWith('/(auth)')
  })
})

describe('(pro)/messages', () => {
  it('lists chats for approved stylists only', async () => {
    routeApi(api, { 'GET /api/v1/pro/conversations': [] })
    const { default: Messages } = await import('@/app/(pro)/messages')
    expect((await renderScreen(<Messages />)).text()).toContain('No messages yet')
    signInAs({ status: 'pending' })
    const pending = await renderScreen(<Messages />)
    expect(pending.text()).toContain('Messaging opens after approval')
  })
})

describe('(pro)/schedule', () => {
  const booking = (id: string, status: string, date = '2099-01-01') => ({
    _id: id, bookingDate: date, startTime: '10:00', endTime: '11:00', status, totalAmount: 500_000, discountAmount: 50_000, notes: 'Wash first',
    customer: { _id: 'c1', fullName: `Customer ${id}` }, style: 'knotless-braids',
  })

  it('shows upcoming active bookings only, with the next actions', async () => {
    routeApi(api, { 'GET /api/v1/pro/bookings?status=all': [booking('b1', 'pending'), booking('b2', 'completed'), booking('b3', 'confirmed', '2000-01-01')] })
    const { default: Schedule } = await import('@/app/(pro)/schedule')
    const s = await renderScreen(<Schedule />)
    expect(s.text()).toContain('Customer b1')
    expect(s.text()).not.toContain('Customer b2')
    expect(s.text()).not.toContain('Customer b3')
    expect(s.text()).toContain('₦4,500')
    expect(s.text()).toContain('“Wash first”')
    expect(s.text()).toContain('Knotless Braids')
    expect(s.hasButton('Confirm')).toBe(true)
    expect(s.hasButton('Decline')).toBe(true)
  })

  it('confirms directly but asks before cancelling or no-shows', async () => {
    routeApi(api, { 'GET /api/v1/pro/bookings?status=all': [booking('b1', 'pending'), booking('b2', 'confirmed')], 'POST /api/v1/pro/bookings/*': { ok: true } })
    const { default: Schedule } = await import('@/app/(pro)/schedule')
    const s = await renderScreen(<Schedule />)
    await s.press('Confirm')
    expect(sent(api, 'POST /api/v1/pro/bookings/b1/status')).toEqual([{ status: 'confirmed' }])
    await s.press('No-show')
    expect(sent(api, 'POST /api/v1/pro/bookings/b2/status')).toEqual([])
    await pressAlertButton(alert, 'No-show')
    expect(sent(api, 'POST /api/v1/pro/bookings/b2/status')).toEqual([{ status: 'no_show' }])
  })

  it('filters by status and reports failures', async () => {
    routeApi(api, {
      'GET /api/v1/pro/bookings?status=all': [],
      'GET /api/v1/pro/bookings?status=pending': [booking('b9', 'in_progress', '2000-01-01')],
      'POST /api/v1/pro/bookings/*': new ApiError(400, "Can't move a completed booking"),
    })
    const { default: Schedule } = await import('@/app/(pro)/schedule')
    const s = await renderScreen(<Schedule />)
    expect(s.text()).toContain('Nothing here')
    await s.press('To confirm')
    expect(s.text()).toContain('Customer b9')
    await s.press(/^Complete$/)
    expect(alert).toHaveBeenLastCalledWith('Not updated', "Can't move a completed booking")
  })

  it('waits for approval before showing bookings', async () => {
    signInAs({ status: 'pending' })
    const { default: Schedule } = await import('@/app/(pro)/schedule')
    expect((await renderScreen(<Schedule />)).text()).toContain('Bookings open after approval')
    expect(api).not.toHaveBeenCalled()
  })
})

describe('(pro)/shop', () => {
  const sale = (id: string, status: string, paymentMethod = 'transfer') => ({
    _id: id, orderNumber: `CUT-${id}`, status, paymentMethod, totalAmount: 300_000, createdAt: '2026-06-01T10:00:00Z', customerName: 'Bola',
    items: [{ productName: 'Gel', quantity: 2, priceAtOrder: 150_000 }],
    shippingAddress: { fullName: 'Bola A', address: '1 Road', city: 'Ikeja', phone: '0801' },
  })

  beforeEach(() => {
    routeApi(api, {
      'GET /api/v1/pro/sales?status=all': [sale('1', 'pending'), sale('2', 'paid', 'card'), sale('3', 'delivered')],
      'GET /api/v1/pro/products': [{ _id: 'p1', name: 'Gel', price: 150_000, stock: 3 }, { _id: 'p2', name: 'Oil', price: 100_000, stock: 0, isActive: false }],
      'POST /api/v1/pro/sales/*': { ok: true },
    })
  })

  it('lists open sales with actions, confirming payments after a prompt', async () => {
    const { default: Shop } = await import('@/app/(pro)/shop')
    const s = await renderScreen(<Shop />)
    expect(s.text()).toContain('Cutty commission 10% · paid to GTBank ••••6789')
    expect(s.text()).toContain('Sales (2)')
    expect(s.text()).toContain('Deliver to Bola A, 1 Road, Ikeja · 0801')
    expect(s.text()).not.toContain('#CUT-3')
    await s.press('Payment received')
    expect(alert).toHaveBeenLastCalledWith('Payment received', expect.stringContaining('₦3,000 from Bola'), expect.any(Array))
    await pressAlertButton(alert, 'Payment received')
    expect(sent(api, 'POST /api/v1/pro/sales/1')).toEqual([{ action: 'confirm_payment' }])
    await s.press('Accept order')
    expect(sent(api, 'POST /api/v1/pro/sales/2')).toEqual([{ action: 'accept' }])
    await s.press(/^All$/)
    expect(s.text()).toContain('#CUT-3')
  })

  it('shows products and opens the editor', async () => {
    const { default: Shop } = await import('@/app/(pro)/shop')
    const s = await renderScreen(<Shop />)
    await s.press('Products (2)')
    expect(s.text()).toContain('3 in stock')
    expect(s.text()).toContain('Hidden')
    await s.press('Gel')
    expect(router.push).toHaveBeenCalledWith('/pro/product-edit?id=p1')
    await s.press(/^Add$/)
    expect(router.push).toHaveBeenCalledWith('/pro/product-edit')
  })

  it.each([
    [{ shop: { status: 'none' } }, 'Sell to your customers'],
    [{ shop: { status: 'requested', name: 'Amaka Hair', bankName: 'GTBank', accountNumberLast4: '6789' } }, 'GTBank ••••6789'],
    [{ shop: { status: 'rejected', reviewNote: 'Bank name mismatch' } }, 'Bank name mismatch'],
    [{ shop: { status: 'suspended' } }, 'Shop suspended'],
    [{ status: 'pending', shop: { status: 'none' } }, 'Shops open after profile approval'],
  ])('explains a closed shop: %o', async (over, text) => {
    signInAs(over)
    const { default: Shop } = await import('@/app/(pro)/shop')
    expect((await renderScreen(<Shop />)).text()).toContain(text)
  })
})

describe('pro/availability', () => {
  it('toggles days, adjusts hours, copies Monday to weekdays and saves', async () => {
    routeApi(api, { 'PUT /api/v1/pro/availability': (body: unknown) => stylist({ weeklyAvailability: (body as { weeklyAvailability: unknown[] }).weeklyAvailability }) })
    const { default: Availability } = await import('@/app/pro/availability')
    const s = await renderScreen(<Availability />)
    expect(s.text()).toContain('mondayCopy to Mon–Fri')
    await s.press(s.container.querySelector('[aria-label="From 30 minutes later"]')!)
    await s.press(s.container.querySelector('[aria-label="To 30 minutes later"]')!)
    expect(s.text()).toContain('09:30')
    await s.press('Copy to Mon–Fri')
    await s.press(s.container.querySelector('[aria-label="Work on saturday"]')!)
    await s.press(s.container.querySelector('[aria-label="Work on friday"]')!) // friday off again
    const today = new Date()
    await s.press(new RegExp(`^${today.toLocaleDateString('en', { weekday: 'short' })}${today.getDate()}${today.toLocaleDateString('en', { month: 'short' })}$`))
    expect(s.text()).toContain('1 selected.')
    await s.press('Save availability')
    const [body] = sent(api, 'PUT /api/v1/pro/availability') as Array<{ weeklyAvailability: Array<{ day: string; start: string; end: string }>; timeOff: string[] }>
    expect(body.weeklyAvailability.map((w) => `${w.day} ${w.start}-${w.end}`)).toEqual([
      'monday 09:30-17:30', 'tuesday 09:30-17:30', 'wednesday 09:30-17:30', 'thursday 09:30-17:30', 'saturday 09:00-18:00',
    ])
    expect(body.timeOff).toHaveLength(1)
    expect(useAuthStore.getState().stylist!.weeklyAvailability).toHaveLength(5)
    expect(router.back).toHaveBeenCalled()
  })

  it('reports save errors', async () => {
    routeApi(api, { 'PUT /api/v1/pro/availability': new ApiError(400, 'monday: time windows overlap.') })
    const { default: Availability } = await import('@/app/pro/availability')
    const s = await renderScreen(<Availability />)
    await s.press('Save availability')
    expect(alert).toHaveBeenLastCalledWith('Not saved', 'monday: time windows overlap.')
  })
})

describe('pro/customers', () => {
  const rows = [
    { customerId: 'c1', name: 'Kemi Ade', tier: 'gold', visits: 5, productsPurchased: 1, totalSpent: 2_000_000, bonusGiven: 100, lastVisit: '2026-05-01' },
    { customerId: 'c2', name: 'Bola', tier: 'bronze', visits: 1, productsPurchased: 4, totalSpent: 9_000_000, bonusGiven: 0, lastVisit: '2026-06-01' },
  ]

  beforeEach(() => {
    routeApi(api, {
      'GET /api/v1/pro/customers': rows,
      'GET /api/v1/pro/dashboard': { totals: { bonusPointsThisMonth: 300, bonusMonthlyCap: 2000 } },
      'POST /api/v1/pro/customers/*': { ok: true, remainingThisMonth: 1600 },
    })
  })

  it('lists customers with stats and sorts them', async () => {
    const { default: Customers } = await import('@/app/pro/customers')
    const s = await renderScreen(<Customers />)
    expect(s.text()).toContain('Bonus points this month: 300 of 2000')
    expect(s.text()).toContain('gold member · last visit 2026-05-01')
    expect(s.text().indexOf('Kemi')).toBeLessThan(s.text().indexOf('Bola'))
    await s.press('Top spend')
    expect(s.text().indexOf('Bola')).toBeLessThan(s.text().indexOf('Kemi'))
    await s.press('Recent')
    expect(s.text().indexOf('Bola')).toBeLessThan(s.text().indexOf('Kemi'))
  })

  it('sends bonus points with a note', async () => {
    const { default: Customers } = await import('@/app/pro/customers')
    const s = await renderScreen(<Customers />)
    await s.press(s.container.querySelector('[aria-label="Give Kemi Ade bonus points"]')!)
    expect(s.text()).toContain('Bonus for Kemi')
    await s.press('100 pts')
    await s.type("Message they'll see", 'Thanks for 5 visits!')
    await s.press('Send 100 points')
    expect(sent(api, 'POST /api/v1/pro/customers/c1/bonus')).toEqual([{ points: 100, note: 'Thanks for 5 visits!' }])
    expect(alert).toHaveBeenLastCalledWith('Bonus sent', 'Kemi Ade received 100 points. 1600 points left for this month.')
    expect(s.container.querySelector('[role=dialog]')).toBeNull()
  })

  it('rejects non-whole numbers and shows limit errors', async () => {
    routeApi(api, {
      'GET /api/v1/pro/customers': rows,
      'GET /api/v1/pro/dashboard': { totals: { bonusPointsThisMonth: 1900, bonusMonthlyCap: 2000 } },
      'POST /api/v1/pro/customers/*': new ApiError(400, 'That would pass your monthly bonus limit (100 points left this month).'),
    })
    const { default: Customers } = await import('@/app/pro/customers')
    const s = await renderScreen(<Customers />)
    await s.press(s.container.querySelector('[aria-label="Give Bola bonus points"]')!)
    await s.type('Points', '2.5')
    await s.press('Send 2.5 points')
    expect(alert).toHaveBeenLastCalledWith('Points', 'Enter a whole number of points.')
    await s.type('Points', '200')
    await s.press('Send 200 points')
    expect(alert).toHaveBeenLastCalledWith('Not sent', expect.stringContaining('monthly bonus limit'))
  })
})

describe('pro/product-edit', () => {
  beforeEach(() => {
    vi.mocked(pickFromLibrary).mockResolvedValue({ uri: 'file:///p.jpg', base64: 'x', mediaType: 'image/jpeg' })
    vi.mocked(uploadProImage).mockResolvedValue(ASSET)
  })

  it('creates a product, uploading photos as they are picked', async () => {
    routeApi(api, { 'GET /api/v1/catalog/categories': [{ _id: 'cat1', name: 'Hair' }], 'POST /api/v1/pro/products': { _id: 'p9' } })
    const { default: ProductEdit } = await import('@/app/pro/product-edit')
    const s = await renderScreen(<ProductEdit />)
    expect(s.text()).toContain('New product')
    await s.press(s.iconButton('camera-outline'))
    await pressAlertButton(alert, 'Choose from library')
    expect(uploadProImage).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///p.jpg' }), 'product')
    expect(s.text()).toContain('Photos (1/6)')
    await s.type('Rosemary growth oil', 'Rosemary oil')
    await s.type('4500', '4,500')
    await s.type('Optional', '6000')
    await s.press(/^Hair$/)
    await s.type('natural hair, edges', ' growth, , oils ')
    await s.type('What it does', 'For edges.')
    await s.press('Add product')
    expect(sent(api, 'POST /api/v1/pro/products')).toEqual([{
      name: 'Rosemary oil', price: 450_000, compareAtPrice: 600_000, stock: 10, categoryId: 'cat1', description: 'For edges.',
      tags: ['growth', 'oils'], imageAssetIds: [ASSET], isActive: true,
    }])
    expect(router.back).toHaveBeenCalled()
  })

  it.each([
    [{ name: 'X' }, 'Name'],
    [{ name: 'Oil', price: '0.5' }, 'Price'],
    [{ name: 'Oil', price: '100', compareAt: '50' }, 'Original price'],
    [{ name: 'Oil', price: '100', stock: '-1' }, 'Stock'],
  ])('validates %o', async (values, title) => {
    routeApi(api, { 'GET /api/v1/catalog/categories': [] })
    const { default: ProductEdit } = await import('@/app/pro/product-edit')
    const s = await renderScreen(<ProductEdit />)
    if (values.name) await s.type('Rosemary growth oil', values.name)
    if ('price' in values) await s.type('4500', values.price!)
    if ('compareAt' in values) await s.type('Optional', values.compareAt!)
    if ('stock' in values) await s.type(s.inputs()[3], values.stock!)
    await s.press('Add product')
    expect(alert).toHaveBeenLastCalledWith(title, expect.any(String))
  })

  it('loads an existing product for editing and can hide it', async () => {
    setParams({ id: 'p1' })
    routeApi(api, {
      'GET /api/v1/catalog/categories': [],
      'GET /api/v1/pro/products': [{
        _id: 'p1', name: 'Gel', price: 150_000, compareAtPrice: 200_000, stock: 3, tags: ['edges'], isActive: true,
        description: [{ children: [{ text: 'Line one' }] }, { children: [{ text: 'Line two' }] }],
        images: [{ asset: { _ref: ASSET } }],
      }],
      'PATCH /api/v1/pro/products/p1': { ok: true },
    })
    const { default: ProductEdit } = await import('@/app/pro/product-edit')
    const s = await renderScreen(<ProductEdit />)
    expect(s.text()).toContain('Edit product')
    expect(s.input('Rosemary growth oil').value).toBe('Gel')
    expect(s.input('4500').value).toBe('1500')
    expect(s.input('What it does').value).toBe('Line one\n\nLine two')
    await s.press(s.container.querySelector('[aria-label="Remove photo"]')!)
    await s.press('Hide from shop')
    await s.press('Save changes')
    expect(sent(api, 'PATCH /api/v1/pro/products/p1')[0]).toMatchObject({ price: 150_000, compareAtPrice: 200_000, imageAssetIds: [], isActive: false, tags: ['edges'] })
  })

  it('goes back when the product is not the stylist’s', async () => {
    setParams({ id: 'nope' })
    routeApi(api, { 'GET /api/v1/catalog/categories': [], 'GET /api/v1/pro/products': [] })
    const { default: ProductEdit } = await import('@/app/pro/product-edit')
    await renderScreen(<ProductEdit />)
    expect(alert).toHaveBeenLastCalledWith('Product', 'Could not load this product.', expect.any(Array))
    await pressAlertButton(alert, 'OK')
    expect(router.back).toHaveBeenCalled()
  })
})

describe('pro/profile-edit', () => {
  it('saves profile details, skills, styles, away assistant and a new photo', async () => {
    vi.mocked(captureFromCamera).mockResolvedValue({ uri: 'file:///me.jpg', base64: 'x', mediaType: 'image/jpeg' })
    vi.mocked(uploadProImage).mockResolvedValue(ASSET)
    routeApi(api, { 'PATCH /api/v1/pro/me': (body: object) => stylist(body as Record<string, unknown>) })
    const { default: ProfileEdit } = await import('@/app/pro/profile-edit')
    const s = await renderScreen(<ProfileEdit />)

    await s.press(s.container.querySelector('[aria-label="Change profile photo"]')!)
    await pressAlertButton(alert, 'Take photo')
    await s.type('Amaka Obi', 'Amaka B.')
    await s.type('e.g. 6', '7')
    await s.type('Tell customers', ' Braids & locs. ')
    await s.press(/^Locs$/)
    await s.press(/^Knotless braids$/) // deselect
    await s.type('Add another skill', 'Crochet')
    await s.press(s.button(/^Add$/))
    await s.press(TRY_ON_STYLES.find((t) => t.id === 'box-braids')!.label)
    await s.type('Add a style not listed', 'Fulani braids')
    await s.press([...s.container.querySelectorAll('button')].filter((b) => b.textContent === 'Add')[1])
    await s.press(s.container.querySelector('[aria-label="Let Cutty AI reply while you\'re offline"]')!)
    await s.type('e.g. I work from Lekki', 'Lekki Phase 1')
    expect(s.input('e.g. 5000').value).toBe('5000')
    await s.type('e.g. 5000', '7,500')
    await s.press(/^2 hr$/)
    await s.press('Save profile')

    expect(uploadProImage).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///me.jpg' }), 'photo')
    expect(sent(api, 'PATCH /api/v1/pro/me')).toEqual([{
      displayName: 'Amaka B.', phone: '08012345678', bio: 'Braids & locs.', yearsExperience: 7, kind: 'braider',
      skills: ['Locs', 'Crochet'], styles: ['knotless-braids', 'box-braids', 'Fulani braids'],
      awayAssistant: { enabled: true, notes: 'Lekki Phase 1' }, location: null, photoAssetId: ASSET,
      bookingPrice: 750_000, bookingDuration: 120,
    }])
    expect(router.back).toHaveBeenCalled()
  })

  it('shows style options for the chosen kind and validates experience', async () => {
    const { default: ProfileEdit } = await import('@/app/pro/profile-edit')
    const s = await renderScreen(<ProfileEdit />)
    expect(s.text()).not.toContain('Buzz Cut') // braider
    await s.press(/^Barber$/)
    expect(s.text()).toContain('Buzz Cut')
    await s.type('e.g. 6', '80')
    await s.press('Save profile')
    expect(alert).toHaveBeenLastCalledWith('Years of experience', 'Enter a whole number between 0 and 70.')
    await s.type('e.g. 6', '8')
    await s.type('e.g. 5000', 'free')
    await s.press('Save profile')
    expect(alert).toHaveBeenLastCalledWith('Appointment price', expect.stringContaining('between ₦1 and ₦1,000,000'))
    expect(api).not.toHaveBeenCalled()
  })
})

describe('pro/shop-setup', () => {
  const banks = [{ code: '058', name: 'GTBank' }, { code: '044', name: 'Access Bank' }]

  it('verifies the account holder and sends the shop request', async () => {
    signInAs({ shop: { status: 'none' } })
    routeApi(api, {
      'GET /api/v1/pro/banks': banks,
      'POST /api/v1/pro/banks': { accountName: 'AMAKA OBI' },
      'POST /api/v1/pro/shop': stylist({ shop: { status: 'requested' } }),
    })
    const { default: ShopSetup } = await import('@/app/pro/shop-setup')
    const s = await renderScreen(<ShopSetup />)
    expect(s.button('Send shop request').disabled).toBe(true)
    await s.type("e.g. Amaka's Hair Care", 'Amaka Hair')
    await s.press('Choose your bank')
    await s.type('Search banks', 'acc')
    expect(s.text()).not.toContain('GTBank')
    await s.press('Access Bank')
    await s.type('0123456789', '01-2345-6789')
    expect(sent(api, 'POST /api/v1/pro/banks')).toEqual([{ accountNumber: '0123456789', bankCode: '044' }])
    expect(s.text()).toContain('✓ AMAKA OBI')
    await s.press('Send shop request')
    expect(sent(api, 'POST /api/v1/pro/shop')).toEqual([{ name: 'Amaka Hair', description: undefined, bankCode: '044', accountNumber: '0123456789' }])
    expect(useAuthStore.getState().stylist!.shop.status).toBe('requested')
    await pressAlertButton(alert, 'OK')
    expect(router.back).toHaveBeenCalled()
  })

  it('alerts when the account cannot be resolved', async () => {
    routeApi(api, { 'GET /api/v1/pro/banks': banks, 'POST /api/v1/pro/banks': new ApiError(502, 'Could not resolve account name') })
    const { default: ShopSetup } = await import('@/app/pro/shop-setup')
    const s = await renderScreen(<ShopSetup />)
    await s.press('Choose your bank')
    await s.press('GTBank')
    await s.type('0123456789', '9999999999')
    expect(alert).toHaveBeenLastCalledWith('Account not found', 'Could not resolve account name')
    expect(s.button('Send shop request').disabled).toBe(true)
  })

  it('requires an approved profile first', async () => {
    signInAs({ status: 'pending' })
    routeApi(api, { 'GET /api/v1/pro/banks': banks })
    const { default: ShopSetup } = await import('@/app/pro/shop-setup')
    expect((await renderScreen(<ShopSetup />)).text()).toContain('Profile approval first')
  })
})
