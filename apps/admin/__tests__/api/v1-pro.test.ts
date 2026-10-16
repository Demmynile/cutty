import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'
import { json, params, request } from '../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/stylistAuth', () => ({ requireStylist: vi.fn(), findStylist: vi.fn() }))
vi.mock('@/lib/server/clerk', () => ({ requireClerkUser: vi.fn(), clerkIdentity: vi.fn() }))
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/stylists', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/stylists')>()),
  loadAccount: vi.fn(async (id: string) => ({ _id: id, email: 's@x', status: 'approved' })),
  syncBarber: vi.fn(),
  uploadImage: vi.fn(async () => ({ _type: 'image', asset: { _type: 'reference', _ref: 'image-abc-1x1-png' } })),
}))
vi.mock('@/lib/server/paystack', () => ({ listBanks: vi.fn(), resolveAccount: vi.fn() }))
vi.mock('@/lib/server/stylistStats', () => ({ customerStats: vi.fn(), dashboard: vi.fn(), bonusGivenThisMonth: vi.fn(), marketplaceSettings: vi.fn() }))
vi.mock('@/lib/server/bookings', () => ({ changeBookingStatus: vi.fn() }))
vi.mock('@/lib/server/orders', () => ({ markOrderPaid: vi.fn() }))
vi.mock('ai', () => ({ generateObject: vi.fn() }))

const { requireStylist, findStylist } = await import('@/lib/server/stylistAuth')
const { requireClerkUser, clerkIdentity } = await import('@/lib/server/clerk')
const { audit } = await import('@/lib/server/audit')
const { loadAccount, syncBarber, uploadImage } = await import('@/lib/server/stylists')
const { listBanks, resolveAccount } = await import('@/lib/server/paystack')
const { customerStats, dashboard, bonusGivenThisMonth, marketplaceSettings } = await import('@/lib/server/stylistStats')
const { changeBookingStatus } = await import('@/lib/server/bookings')
const { markOrderPaid } = await import('@/lib/server/orders')
const { generateObject } = await import('ai')

const register = await import('@/app/api/v1/pro/auth/register/route')
const proSession = await import('@/app/api/v1/pro/auth/session/route')
const proMe = await import('@/app/api/v1/pro/me/route')
const availability = await import('@/app/api/v1/pro/availability/route')
const banks = await import('@/app/api/v1/pro/banks/route')
const shop = await import('@/app/api/v1/pro/shop/route')
const uploads = await import('@/app/api/v1/pro/uploads/route')
const dash = await import('@/app/api/v1/pro/dashboard/route')
const products = await import('@/app/api/v1/pro/products/route')
const productById = await import('@/app/api/v1/pro/products/[id]/route')
const proBookings = await import('@/app/api/v1/pro/bookings/route')
const bookingStatus = await import('@/app/api/v1/pro/bookings/[id]/status/route')
const sales = await import('@/app/api/v1/pro/sales/route')
const saleById = await import('@/app/api/v1/pro/sales/[id]/route')
const customers = await import('@/app/api/v1/pro/customers/route')
const bonus = await import('@/app/api/v1/pro/customers/[id]/bonus/route')
const proConversations = await import('@/app/api/v1/pro/conversations/route')
const proMessages = await import('@/app/api/v1/pro/conversations/[id]/messages/route')
const suggest = await import('@/app/api/v1/pro/conversations/[id]/suggest/route')

const ME = { stylistId: 's1', email: 's@x', status: 'approved' as const, shopStatus: 'approved' as const, barberId: 'b1' }
const ASSET = 'image-0123456789abcdef0123-640x480-jpg'

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireStylist).mockResolvedValue(ME)
  vi.mocked(requireClerkUser).mockResolvedValue('u1')
})

describe('auth', () => {
  const profile = { fullName: 'Ada Obi', phone: '08012345678', kind: 'braider' }

  it('register creates a pending stylist with the verified email', async () => {
    vi.mocked(findStylist).mockResolvedValue(null)
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u1', email: 'ada@x', fullName: null })
    const res = await json(await register.POST(request('POST', '/', profile), {}))
    expect(res.status).toBe(201)
    expect(sanity.creates()[0]).toMatchObject({
      _type: 'stylist', clerkUserId: 'u1', email: 'ada@x', fullName: 'Ada Obi', kind: 'braider',
      status: 'pending', shop: { status: 'none' }, isActive: true, skills: [], weeklyAvailability: [],
    })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'stylist.register' }))
    expect(sanity.creates()[0]).not.toHaveProperty('location') // older app versions send none
  })

  it('register stores the work location from sign-up as a geopoint, dropping empty parts', async () => {
    vi.mocked(findStylist).mockResolvedValue(null)
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u1', email: 'ada@x', fullName: null })
    const location = { lat: 6.43, lng: 3.47, address: '12 Admiralty Way', area: 'Lekki Phase 1', city: 'Lagos', state: 'Lagos', postcode: '106104' }
    expect((await register.POST(request('POST', '/', { ...profile, location: { ...location, address: ' ' } }), {})).status).toBe(201)
    expect(sanity.creates()[0].location).toEqual({
      point: { _type: 'geopoint', lat: 6.43, lng: 3.47 }, area: 'Lekki Phase 1', city: 'Lagos', state: 'Lagos', postcode: '106104',
    })
  })

  it('register creates one profile per Clerk user, even when submitted twice at once', async () => {
    vi.mocked(findStylist).mockResolvedValue(null)
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u1', email: 'ada@x', fullName: null })
    expect((await register.POST(request('POST', '/', profile), {})).status).toBe(201)
    expect(sanity.creates()[0]).toMatchObject({ _id: 'stylist-u1' })
    sanity.failNextCommit(Object.assign(new Error('exists'), { statusCode: 409 }))
    expect(await json(await register.POST(request('POST', '/', profile), {}))).toEqual({ status: 409, body: { error: 'You already have a Cutty Pro account. Sign in instead.' } })
  })

  it('register refuses duplicates, unverified emails and bad bodies', async () => {
    vi.mocked(findStylist).mockResolvedValue({ stylistId: 's1', linked: false })
    expect((await register.POST(request('POST', '/', profile), {})).status).toBe(409)

    vi.mocked(findStylist).mockResolvedValue(null)
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u1', email: null, fullName: null })
    expect((await register.POST(request('POST', '/', profile), {})).status).toBe(403)

    expect((await register.POST(request('POST', '/', { ...profile, kind: 'tattooist' }), {})).status).toBe(400)
    for (const location of [{ lat: 91, lng: 3 }, { lat: 6, lng: 3, postcode: 'x'.repeat(13) }, { lat: 6, lng: 3, country: 'NG' }]) {
      expect((await register.POST(request('POST', '/', { ...profile, location }), {})).status).toBe(400)
    }
    expect(sanity.writes).toEqual([])
  })

  it('session returns the account, or 404 needsProfile for a new Clerk user', async () => {
    vi.mocked(findStylist).mockResolvedValue({ stylistId: 's1', linked: true })
    expect((await json(await proSession.POST(request('POST', '/'), {}))).body).toEqual({ stylist: { _id: 's1', email: 's@x', status: 'approved' } })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'stylist.link_clerk' }))

    vi.mocked(findStylist).mockResolvedValue(null)
    expect(await json(await proSession.POST(request('POST', '/'), {}))).toEqual({ status: 404, body: { error: expect.any(String), needsProfile: true } })
  })

  it('session refuses a suspended stylist', async () => {
    vi.mocked(findStylist).mockResolvedValue({ stylistId: 's1', linked: false })
    vi.mocked(loadAccount).mockResolvedValueOnce({ _id: 's1', status: 'suspended' } as never)
    expect((await proSession.POST(request('POST', '/'), {})).status).toBe(403)
  })
})

describe('profile', () => {
  it('GET me returns the masked account', async () => {
    expect((await json(await proMe.GET(request('GET', '/'), {}))).body).toMatchObject({ _id: 's1' })
  })

  it('PATCH me sets, de-duplicates and clears fields, then re-syncs the barber', async () => {
    await proMe.PATCH(request('PATCH', '/', {
      phone: '08011112222', skills: ['fades', 'fades', 'waves'], displayName: null, bio: 'Hi', yearsExperience: null,
      photoAssetId: ASSET, awayAssistant: { enabled: true, notes: null }, bookingPrice: 500_000, bookingDuration: 90,
      location: { lat: 6.6, lng: 3.35, area: 'Ikeja', city: 'Lagos', postcode: '100271' },
    }), {})
    const patch = sanity.patches()[0]
    expect(patch.set).toMatchObject({
      phone: '08011112222', skills: ['fades', 'waves'], bio: 'Hi',
      photo: { asset: { _ref: ASSET } }, awayAssistant: { enabled: true }, bookingPrice: 500_000, bookingDuration: 90,
      location: { point: { _type: 'geopoint', lat: 6.6, lng: 3.35 }, area: 'Ikeja', city: 'Lagos', postcode: '100271' },
    })
    expect(patch.set.awayAssistant).not.toHaveProperty('notes')
    expect(patch.unset).toEqual(['displayName', 'yearsExperience'])
    expect(syncBarber).toHaveBeenCalledWith('s1')
  })

  it.each([{ status: 'approved' }, { rating: 5 }, { shop: {} }, { photoAssetId: 'https://x/y.jpg' }, { awayAssistant: { enabled: true, extra: 1 } }, { bookingPrice: 50 }, { bookingPrice: 1000.5 }, { bookingDuration: 5 }])(
    'PATCH me rejects %o',
    async (bad) => {
      expect((await proMe.PATCH(request('PATCH', '/', bad), {})).status).toBe(400)
      expect(sanity.writes).toEqual([])
    },
  )

  it('PUT availability stores keyed windows and sorted unique days off', async () => {
    await availability.PUT(request('PUT', '/', {
      weeklyAvailability: [{ day: 'monday', start: '09:00', end: '12:00' }, { day: 'monday', start: '13:00', end: '17:00' }],
      timeOff: ['2026-07-02', '2026-07-01', '2026-07-02'],
    }), {})
    expect(sanity.patches()[0].set).toEqual({
      weeklyAvailability: [{ _key: 'monday-0', day: 'monday', start: '09:00', end: '12:00' }, { _key: 'monday-1', day: 'monday', start: '13:00', end: '17:00' }],
      timeOff: ['2026-07-01', '2026-07-02'],
    })
    expect(syncBarber).toHaveBeenCalled()
  })

  it.each([
    ['end before start', [{ day: 'monday', start: '12:00', end: '09:00' }], /end time must be after/],
    ['overlapping windows', [{ day: 'friday', start: '09:00', end: '12:00' }, { day: 'friday', start: '11:00', end: '14:00' }], /overlap/],
  ])('PUT availability rejects %s', async (_l, weeklyAvailability, msg) => {
    const res = await json(await availability.PUT(request('PUT', '/', { weeklyAvailability, timeOff: [] }), {}))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(msg)
  })

  it('PUT availability rejects invalid times and days', async () => {
    expect((await availability.PUT(request('PUT', '/', { weeklyAvailability: [{ day: 'funday', start: '09:00', end: '10:00' }], timeOff: [] }), {})).status).toBe(400)
    expect((await availability.PUT(request('PUT', '/', { weeklyAvailability: [{ day: 'monday', start: '24:00', end: '25:00' }], timeOff: [] }), {})).status).toBe(400)
  })

  it('POST uploads stores the image and returns its asset id', async () => {
    const res = await json(await uploads.POST(request('POST', '/', { base64: 'aGk=', mediaType: 'image/png', purpose: 'photo' }), {}))
    expect(res).toMatchObject({ status: 201, body: { assetId: 'image-abc-1x1-png' } })
    expect(uploadImage).toHaveBeenCalledWith('aGk=', 'image/png', 'photo-s1.png')
    expect((await uploads.POST(request('POST', '/', { base64: 'aGk=', mediaType: 'image/gif', purpose: 'photo' }), {})).status).toBe(400)
  })

  it('GET dashboard passes the session through', async () => {
    vi.mocked(dashboard).mockResolvedValue({ totals: {} } as never)
    await dash.GET(request('GET', '/'), {})
    expect(dashboard).toHaveBeenCalledWith({ stylistId: 's1', barberId: 'b1', status: 'approved', shopStatus: 'approved' })
  })
})

describe('shop and banks', () => {
  const body = { name: 'Ada Hair', bankCode: '058', accountNumber: '0123456789' }

  beforeEach(() => {
    vi.mocked(listBanks).mockResolvedValue([{ code: '058', name: 'GTBank' }])
    vi.mocked(resolveAccount).mockResolvedValue('ADA OBI')
  })

  it('GET banks lists banks; POST banks resolves an account name', async () => {
    expect((await json(await banks.GET(request('GET', '/'), {}))).body).toEqual([{ code: '058', name: 'GTBank' }])
    expect((await json(await banks.POST(request('POST', '/', { accountNumber: '0123456789', bankCode: '058' }), {}))).body).toEqual({ accountName: 'ADA OBI' })
    expect((await banks.POST(request('POST', '/', { accountNumber: '123', bankCode: '058' }), {})).status).toBe(400)
  })

  it('POST shop requests a shop with a verified bank account', async () => {
    vi.mocked(requireStylist).mockResolvedValue({ ...ME, shopStatus: 'none' })
    expect((await shop.POST(request('POST', '/', body), {})).status).toBe(200)
    expect(sanity.patches()[0].set.shop).toMatchObject({ status: 'requested', name: 'Ada Hair', bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'ADA OBI' })
  })

  it.each([
    ['an unapproved profile', { status: 'pending', shopStatus: 'none' }, 403],
    ['an already open shop', { status: 'approved', shopStatus: 'approved' }, 409],
    ['a suspended shop', { status: 'approved', shopStatus: 'suspended' }, 403],
  ] as const)('POST shop refuses %s', async (_l, over, status) => {
    vi.mocked(requireStylist).mockResolvedValue({ ...ME, ...over })
    expect((await shop.POST(request('POST', '/', body), {})).status).toBe(status)
  })

  it('POST shop 400s for an unknown bank', async () => {
    vi.mocked(requireStylist).mockResolvedValue({ ...ME, shopStatus: 'rejected' })
    expect((await shop.POST(request('POST', '/', { ...body, bankCode: '999' }), {})).status).toBe(400)
    expect(resolveAccount).not.toHaveBeenCalled()
  })
})

describe('products', () => {
  it('POST creates a product in the stylist’s shop with a unique slug', async () => {
    const res = await json(await products.POST(request('POST', '/', { name: 'Edge Gel!', price: 300_000, stock: 4, imageAssetIds: [ASSET] }), {}))
    expect(res.status).toBe(201)
    expect(sanity.creates()[0]).toMatchObject({
      _type: 'product', name: 'Edge Gel!', price: 300_000, pointsEarned: 30, stock: 4, isActive: true, isFeatured: false,
      seller: { _ref: 's1' }, slug: { current: `edge-gel-${res.body._id.slice(0, 6)}` }, images: [{ asset: { _ref: ASSET } }],
    })
  })

  it('GET lists own products', async () => {
    sanity.on('seller._ref == $stylistId]', [{ _id: 'p1' }])
    expect((await json(await products.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'p1' }])
  })

  it('PATCH updates an owned product, unsetting nulled fields; DELETE hides it', async () => {
    sanity.on('_type == "product" && _id == $id', { _id: 'p1', _rev: 'r' })
    await productById.PATCH(request('PATCH', '/', { stock: 0, compareAtPrice: null, categoryId: null }), params({ id: 'p1' }))
    expect(sanity.patches()[0]).toMatchObject({ id: 'p1', ifRevisionId: 'r', set: { stock: 0 }, unset: ['compareAtPrice', 'category'] })
    await productById.DELETE(request('DELETE', '/'), params({ id: 'p1' }))
    expect(sanity.patches()[1]).toMatchObject({ set: { isActive: false } })
  })

  it("404s for another stylist's product", async () => {
    expect((await productById.DELETE(request('DELETE', '/'), params({ id: 'p9' }))).status).toBe(404)
  })
})

describe('bookings', () => {
  it('GET lists bookings for a known status filter, defaulting unknown ones to all', async () => {
    sanity.on('_type == "booking"', [])
    await proBookings.GET(request('GET', '/x?status=confirmed'), {})
    await proBookings.GET(request('GET', '/x?status=hacked'), {})
    expect(sanity.client.fetch.mock.calls.map((c) => c[1])).toEqual([{ barberId: 'b1', status: 'confirmed' }, { barberId: 'b1', status: 'all' }])
  })

  it('GET returns [] for a stylist without a bookable profile', async () => {
    vi.mocked(requireStylist).mockResolvedValue({ ...ME, barberId: undefined })
    expect((await json(await proBookings.GET(request('GET', '/'), {}))).body).toEqual([])
  })

  it('POST status changes only their own bookings', async () => {
    vi.mocked(changeBookingStatus).mockResolvedValue({ ok: true })
    expect((await bookingStatus.POST(request('POST', '/', { status: 'completed' }), params({ id: 'bk1' }))).status).toBe(200)
    expect(changeBookingStatus).toHaveBeenCalledWith({ bookingId: 'bk1', status: 'completed', barberId: 'b1', actor: { type: 'stylist', id: 's1', email: 's@x' } })

    vi.mocked(changeBookingStatus).mockResolvedValue({ ok: false, error: 'nope' })
    expect(await json(await bookingStatus.POST(request('POST', '/', { status: 'confirmed' }), params({ id: 'bk1' })))).toEqual({ status: 400, body: { error: 'nope' } })
    expect((await bookingStatus.POST(request('POST', '/', { status: 'pending' }), params({ id: 'bk1' }))).status).toBe(400)

    vi.mocked(requireStylist).mockResolvedValue({ ...ME, barberId: undefined })
    expect((await bookingStatus.POST(request('POST', '/', { status: 'confirmed' }), params({ id: 'bk1' }))).status).toBe(404)
  })
})

describe('sales', () => {
  const sale = (over: object = {}) => ({ _id: 'o1', _rev: 'r', status: 'pending', orderNumber: 'CUT-1', paymentMethod: 'transfer', pointsEarned: 5, customerId: 'c1', ...over })
  const act = (action: string) => saleById.POST(request('POST', '/', { action }), params({ id: 'o1' }))

  it('GET lists sales filtered by a known status', async () => {
    sanity.on('_type == "order"', [])
    await sales.GET(request('GET', '/x?status=paid'), {})
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { stylistId: 's1', status: 'paid' })
  })

  it('confirm_payment marks a pending transfer paid', async () => {
    sanity.on('_type == "order"', sale())
    expect(await json(await act('confirm_payment'))).toEqual({ status: 200, body: { ok: true, status: 'paid' } })
    expect(markOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ _id: 'o1' }), expect.objectContaining({ markedPaidBy: 's@x' }))
  })

  it('confirm_payment awards no loyalty points, even for an order created with points', async () => {
    sanity.on('_type == "order"', sale({ pointsEarned: 500 }))
    await act('confirm_payment')
    expect(markOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ pointsEarned: 0 }), expect.objectContaining({ pointsEarned: 0 }))
  })

  it.each([
    ['accept', 'paid', 'processing'],
    ['ship', 'processing', 'shipped'],
    ['deliver', 'shipped', 'delivered'],
    ['cancel', 'pending', 'cancelled'],
  ])('%s moves %s → %s', async (action, from, to) => {
    sanity.on('_type == "order"', sale({ status: from }))
    expect((await json(await act(action))).body).toEqual({ ok: true, status: to })
    expect(sanity.patches()[0]).toMatchObject({ id: 'o1', ifRevisionId: 'r', set: { status: to } })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'stylist.sale_status', details: { from, to } }))
  })

  it('refuses out-of-order actions and card orders that Paystack handles', async () => {
    sanity.on('_type == "order"', sale({ status: 'shipped' }))
    expect((await act('accept')).status).toBe(400)
    sanity.reset()
    sanity.on('_type == "order"', sale({ paymentMethod: 'card' }))
    expect((await json(await act('confirm_payment'))).body.error).toMatch(/Paystack/)
    expect((await json(await act('cancel'))).body.error).toMatch(/close by themselves/)
    expect(sanity.writes).toEqual([])
    expect(markOrderPaid).not.toHaveBeenCalled()
  })

  it("404s for another shop's order", async () => {
    expect((await act('accept')).status).toBe(404)
  })
})

describe('customers and bonuses', () => {
  beforeEach(() => {
    vi.mocked(customerStats).mockResolvedValue([{ customerId: 'c1' }] as never)
    vi.mocked(bonusGivenThisMonth).mockResolvedValue(1_900)
    vi.mocked(marketplaceSettings).mockResolvedValue({ commissionPercent: 10, bonusMaxPerAward: 200, bonusMonthlyCap: 2_000, bookingPointsMaxPerVisit: 300, bookingPointsMonthlyCap: 5_000 })
    sanity.on('_type == "customer" && _id == $id', { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 0, loyaltyPoints: 10, totalVisits: 1, tier: 'bronze' })
  })

  const give = (points: number, customer = 'c1') => bonus.POST(request('POST', '/', { points, note: 'Thanks!' }), params({ id: customer }))

  it('GET customers returns stats for the stylist', async () => {
    expect((await json(await customers.GET(request('GET', '/'), {}))).body).toEqual([{ customerId: 'c1' }])
    expect(customerStats).toHaveBeenCalledWith('s1', 'b1')
  })

  it('awards bonus points to a real customer within the caps', async () => {
    sanity.on('._rev', 'stylist-rev-7')
    expect(await json(await give(100))).toEqual({ status: 200, body: { ok: true, customerPoints: 110, remainingThisMonth: 0 } })
    // Written conditionally on the stylist revision read before the monthly total,
    // so two awards racing past the cap can't both commit.
    expect(sanity.patches()).toContainEqual(expect.objectContaining({ id: 's1', ifRevisionId: 'stylist-rev-7', set: { lastBonusAt: expect.any(String) } }))
    expect(sanity.creates()[0]).toMatchObject({ _type: 'loyaltyTransaction', type: 'bonus', points: 100, balanceAfter: 110, source: 'stylist', stylist: { _ref: 's1' }, description: 'Thanks!' })
  })

  it('refuses strangers, oversize awards and awards past the monthly cap', async () => {
    expect((await give(10, 'stranger')).status).toBe(403)
    expect((await json(await give(201))).body.error).toMatch(/at most 200/)
    expect((await json(await give(101))).body.error).toMatch(/\(100 points left this month\)/)
    expect(sanity.writes).toEqual([])
  })
})

describe('conversations', () => {
  const CONVO = { _id: 'cv1', _rev: 'r', customerId: 'c1', stylistId: 's1' }

  it('GET lists the stylist’s threads', async () => {
    sanity.on('stylist._ref == $stylistId] | order', [{ _id: 'cv1' }])
    expect((await json(await proConversations.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'cv1' }])
  })

  it('GET messages clears the stylist unread count on the newest page', async () => {
    sanity.on('"messages": *[_type == "chatMessage"', { ...CONVO, customerUnread: 0, stylistUnread: 3, messages: [] })
    await proMessages.GET(request('GET', '/x'), params({ id: 'cv1' }))
    await vi.waitFor(() => expect(sanity.patches()).toEqual([expect.objectContaining({ set: { stylistUnread: 0 } })]))
  })

  it('POST suggest drafts replies from the thread, oldest first, with speaker labels', async () => {
    sanity.on('_type == "conversation" && _id == $id', CONVO)
    sanity.on('"stylist"', {
      stylist: { name: 'Ada', kind: 'braider' },
      messages: [{ senderType: 'customer', text: 'price?' }, { senderType: 'ai', text: 'Ada is away' }, { senderType: 'stylist', text: 'hey' }],
    })
    vi.mocked(generateObject).mockResolvedValue({ object: { suggestions: ['₦25k', 'Let me check'] } } as never)
    expect((await json(await suggest.POST(request('POST', '/'), params({ id: 'cv1' })))).body).toEqual({ suggestions: ['₦25k', 'Let me check'] })
    expect((vi.mocked(generateObject).mock.calls[0][0] as { prompt: string }).prompt).toBe('Stylist: hey\nCutty AI: Ada is away\nCustomer: price?')
  })

  it('POST suggest 400s on an empty thread and 502s when the model fails', async () => {
    sanity.on('_type == "conversation" && _id == $id', CONVO)
    sanity.once('"stylist"', { stylist: {}, messages: [] })
    expect((await suggest.POST(request('POST', '/'), params({ id: 'cv1' }))).status).toBe(400)
    sanity.on('"stylist"', { stylist: {}, messages: [{ senderType: 'customer', text: 'hi' }] })
    vi.mocked(generateObject).mockRejectedValue(new Error('x'))
    expect((await suggest.POST(request('POST', '/'), params({ id: 'cv1' }))).status).toBe(502)
  })

  it("POST suggest 404s for another stylist's thread", async () => {
    sanity.on('_type == "conversation" && _id == $id', { ...CONVO, stylistId: 's2' })
    expect((await suggest.POST(request('POST', '/'), params({ id: 'cv1' }))).status).toBe(404)
  })
})
