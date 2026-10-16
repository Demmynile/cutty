import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conflict, sanity } from '../helpers/sanity'
import { json, params, request } from '../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/customerAuth', () => ({ requireCustomer: vi.fn() }))
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/availability', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/availability')>()),
  freeSlots: vi.fn(),
  assertSlotFree: vi.fn(),
}))

const { requireCustomer } = await import('@/lib/server/customerAuth')
const { audit } = await import('@/lib/server/audit')
const { freeSlots, assertSlotFree } = await import('@/lib/server/availability')
const { HttpError } = await import('@/lib/server/http')
const bookings = await import('@/app/api/v1/bookings/route')
const bookingById = await import('@/app/api/v1/bookings/[id]/route')
const cancel = await import('@/app/api/v1/bookings/[id]/cancel/route')
const availability = await import('@/app/api/v1/availability/route')
const catalog = await import('@/app/api/v1/catalog/[...resource]/route')
const stylists = await import('@/app/api/v1/stylists/route')
const stylistById = await import('@/app/api/v1/stylists/[id]/route')

beforeEach(() => {
  sanity.reset()
  vi.useFakeTimers({ now: new Date('2026-06-15T08:00:00Z'), toFake: ['Date'] }) // 09:00 Lagos
  vi.mocked(requireCustomer).mockResolvedValue({ customerId: 'c1', email: 'c@x', clerkUserId: 'u1' })
  vi.mocked(assertSlotFree).mockResolvedValue('11:00')
})
afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/v1/bookings', () => {
  it("lists the caller's bookings only", async () => {
    sanity.on('_type == "booking"', [{ _id: 'b1' }])
    expect(await json(await bookings.GET(request('GET', '/'), {}))).toEqual({ status: 200, body: [{ _id: 'b1' }] })
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { customerId: 'c1' })
  })
})

describe('POST /api/v1/bookings', () => {
  const stylist = { _id: 's1', styles: ['taper-fade', 'Beard sculpt'], bookingPrice: 800_000, bookingDuration: 90 }
  const body = { barberId: 'b1', style: 'taper-fade', date: '2026-06-16', time: '10:00', notes: 'Fade please' }

  beforeEach(() => {
    sanity.on('_type == "stylist" && barber._ref == $id', stylist)
  })

  it("prices the booking from the stylist's appointment price, checks the slot and creates it pending", async () => {
    const res = await json(await bookings.POST(request('POST', '/', body), {}))
    expect(res.status).toBe(201)
    expect(assertSlotFree).toHaveBeenCalledWith('b1', '2026-06-16', '10:00', 90)
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.stringContaining('defined(bookingPrice)'), { id: 'b1' })
    expect(sanity.creates()[0]).toMatchObject({
      _id: res.body._id, _type: 'booking', customer: { _ref: 'c1' }, barber: { _ref: 'b1' }, style: 'taper-fade',
      bookingDate: '2026-06-16', startTime: '10:00', endTime: '11:00',
      totalAmount: 800_000, discountAmount: 0, pointsEarned: 80, paymentMethod: 'cash', status: 'pending', notes: 'Fade please',
    })
    expect(sanity.creates()[0]).not.toHaveProperty('services')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking.create' }))
  })

  it('books without a style when the customer will decide with the stylist', async () => {
    const { style: _, ...noStyle } = body
    expect((await bookings.POST(request('POST', '/', noStyle), {})).status).toBe(201)
    expect(sanity.creates()[0]).not.toHaveProperty('style')
  })

  it('applies and consumes a discount code in the same transaction', async () => {
    sanity.on('_type == "discountCode"', { _id: 'd1', _rev: 'dr', code: 'TEN', type: 'percentage', value: 10, applicableTo: 'booking', usedCount: 0 })
    await bookings.POST(request('POST', '/', { ...body, discountCode: 'ten' }), {})
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.creates[0]).toMatchObject({ discountAmount: 80_000, discountCode: { _ref: 'd1' } })
    expect(tx.patches[0]).toMatchObject({ id: 'd1', ifRevisionId: 'dr', set: { usedCount: 1 } })
  })

  it('409s when the single-use code was used concurrently', async () => {
    sanity.on('_type == "discountCode"', { _id: 'd1', _rev: 'dr', code: 'TEN', type: 'fixed', value: 100, applicableTo: 'both' })
    sanity.failNextCommit(conflict())
    expect(await json(await bookings.POST(request('POST', '/', { ...body, discountCode: 'TEN' }), {})))
      .toEqual({ status: 409, body: { error: 'That discount code was just used. Please try again.' } })
  })

  it('400s for a stylist who is not bookable (unapproved, no price, unavailable) or a style they don’t offer', async () => {
    sanity.reset()
    expect((await json(await bookings.POST(request('POST', '/', body), {}))).body.error).toMatch(/not taking bookings/)

    sanity.reset()
    sanity.on('_type == "stylist" && barber._ref == $id', stylist)
    expect((await json(await bookings.POST(request('POST', '/', { ...body, style: 'Knotless braids' }), {}))).body.error).toMatch(/isn't one this stylist offers/)
    expect(sanity.writes).toEqual([])
  })

  it('caps a customer at 5 upcoming bookings so nobody can block a stylist’s day', async () => {
    sanity.on('count(*[_type == "booking" && customer._ref == $customerId', 5)
    const res = await json(await bookings.POST(request('POST', '/', body), {}))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already have 5 upcoming bookings/)
    expect(sanity.writes).toEqual([])
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.stringContaining('status in ["pending", "confirmed"]'), { customerId: 'c1', today: '2026-06-15' })
  })

  it('refuses times in the past (Lagos time)', async () => {
    for (const when of [{ date: '2026-06-14', time: '12:00' }, { date: '2026-06-15', time: '09:00' }]) {
      const res = await json(await bookings.POST(request('POST', '/', { ...body, ...when }), {}))
      expect(res).toEqual({ status: 400, body: { error: 'Please choose a time in the future.' } })
    }
  })

  it('surfaces slot conflicts from availability', async () => {
    vi.mocked(assertSlotFree).mockRejectedValue(new HttpError(409, 'That time was just booked. Please pick another slot.'))
    expect((await bookings.POST(request('POST', '/', body), {})).status).toBe(409)
  })

  it('validates the body', async () => {
    for (const bad of [{ ...body, barberId: '' }, { ...body, style: '' }, { ...body, date: '16/06/2026' }, { ...body, time: '9am' }, { ...body, notes: 'x'.repeat(501) }]) {
      expect((await bookings.POST(request('POST', '/', bad), {})).status).toBe(400)
    }
  })
})

describe('GET /api/v1/bookings/[id]', () => {
  it('returns the booking when it belongs to the caller, else 404', async () => {
    sanity.on('_type == "booking" && _id == $id && customer._ref == $customerId', (p: { id: string }) => (p.id === 'mine' ? { _id: 'mine' } : null))
    expect(await json(await bookingById.GET(request('GET', '/'), params({ id: 'mine' })))).toEqual({ status: 200, body: { _id: 'mine' } })
    expect((await bookingById.GET(request('GET', '/'), params({ id: 'theirs' }))).status).toBe(404)
  })
})

describe('POST /api/v1/bookings/[id]/cancel', () => {
  it('cancels a pending or confirmed booking conditionally on its revision', async () => {
    sanity.on('_type == "booking"', { _id: 'b1', _rev: 'r', status: 'confirmed' })
    expect(await json(await cancel.POST(request('POST', '/'), params({ id: 'b1' })))).toEqual({ status: 200, body: { ok: true } })
    expect(sanity.patches()[0]).toMatchObject({ id: 'b1', ifRevisionId: 'r', set: { status: 'cancelled', cancelReason: 'Cancelled by customer' } })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking.cancel' }))
  })

  it('refuses bookings already under way or finished', async () => {
    sanity.on('_type == "booking"', { _id: 'b1', _rev: 'r', status: 'in_progress' })
    expect((await cancel.POST(request('POST', '/'), params({ id: 'b1' }))).status).toBe(400)
    expect(sanity.writes).toEqual([])
  })

  it("404s for someone else's booking", async () => {
    expect((await cancel.POST(request('POST', '/'), params({ id: 'b1' }))).status).toBe(404)
  })
})

describe('GET /api/v1/availability', () => {
  it('returns free slots, uncached', async () => {
    vi.mocked(freeSlots).mockResolvedValue(['10:00'])
    const res = await availability.GET(request('GET', '/x?barberId=b1&date=2026-06-16&duration=45'), {})
    expect(await res.json()).toEqual({ slots: ['10:00'] })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(freeSlots).toHaveBeenCalledWith('b1', '2026-06-16', 45)
  })

  it('400s for bad parameters', async () => {
    for (const qs of ['date=2026-06-16&duration=45', 'barberId=b1&date=tomorrow&duration=45', 'barberId=b1&date=2026-06-16&duration=1', 'barberId=b1&date=2026-06-16&duration=abc']) {
      expect((await availability.GET(request('GET', `/x?${qs}`), {})).status).toBe(400)
    }
  })
})

describe('GET /api/v1/catalog/[...resource]', () => {
  const get = (resource: string[], qs = '') => catalog.GET(request('GET', `/x${qs}`), params({ resource }))

  it.each([
    [['categories'], '_type == "category"'],
    [['exchange-rates'], 'exchangeRates'],
    [['products'], 'order(_createdAt desc)'],
  ])('serves %j from an allow-listed query with a public cache header', async (resource, fragment) => {
    sanity.on(fragment, [{ ok: true }])
    const res = await get(resource)
    expect(await res.json()).toEqual([{ ok: true }])
    expect(res.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('serves featured products and single products by slug', async () => {
    sanity.on('][0..5]', [{ featured: true }])
    expect(await (await get(['products'], '?featured=1')).json()).toEqual([{ featured: true }])
    sanity.on('slug.current == $slug', (p: { slug: string }) => (p.slug === 'gel' ? { name: 'Gel' } : null))
    expect(await (await get(['products', 'gel'])).json()).toEqual({ name: 'Gel' })
    expect((await get(['products', 'nope'])).status).toBe(404)
  })

  it('returns null for an empty result and 404s for anything not allow-listed', async () => {
    expect(await (await get(['exchange-rates'])).json()).toBeNull()
    // Services and shop barbers are gone: customers book Cutty Pro stylists.
    for (const r of ['customers', 'services', 'barbers']) expect((await get([r])).status).toBe(404)
    expect(sanity.client.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/v1/stylists', () => {
  const all = [{ _id: 'a', kind: 'barber' }, { _id: 'b', kind: 'braider' }, { _id: 'c', kind: 'both' }]

  it('filters by kind, counting "both" for either', async () => {
    sanity.on('_type == "stylist"', all)
    const ids = async (qs: string) => (await (await stylists.GET(request('GET', `/x${qs}`), {})).json()).map((s: { _id: string }) => s._id)
    expect(await ids('')).toEqual(['a', 'b', 'c'])
    expect(await ids('?kind=barber')).toEqual(['a', 'c'])
    expect(await ids('?kind=braider')).toEqual(['b', 'c'])
    expect(await ids('?kind=wizard')).toEqual(['a', 'b', 'c'])
  })

  it('sorts by distance from ?lat&lng, honours ?radiusKm and puts unpinned stylists last', async () => {
    const pin = (lat: number, lng: number) => ({ lat, lng })
    sanity.on('_type == "stylist"', [
      { _id: 'far', kind: 'barber', location: pin(6.6, 3.35) }, // ~17 km north
      { _id: 'none', kind: 'barber' },
      { _id: 'near', kind: 'barber', location: pin(6.455, 3.395) }, // ~0.1 km
    ])
    const res = await stylists.GET(request('GET', '/x?lat=6.4541&lng=3.3947'), {})
    const body = await res.json()
    expect(body.map((s: { _id: string }) => s._id)).toEqual(['near', 'far', 'none'])
    expect(body[0].distanceKm).toBeLessThan(0.5)
    expect(body[1].distanceKm).toBeGreaterThan(15)
    expect(res.headers.get('Cache-Control')).toContain('private')

    const inRange = await (await stylists.GET(request('GET', '/x?lat=6.4541&lng=3.3947&radiusKm=5'), {})).json()
    expect(inRange.map((s: { _id: string }) => s._id)).toEqual(['near', 'none'])
  })

  it('searches name, skills, styles and area with ?q', async () => {
    sanity.on('_type == "stylist"', [
      { _id: 'a', name: 'Tunde', kind: 'barber', skills: ['Fades'], styles: [] },
      { _id: 'b', name: 'Ada', kind: 'braider', skills: [], styles: ['knotless-braids'], location: { lat: 6.4, lng: 3.4, area: 'Lekki Phase 1' } },
    ])
    const ids = async (qs: string) => (await (await stylists.GET(request('GET', `/x${qs}`), {})).json()).map((s: { _id: string }) => s._id)
    expect(await ids('?q=fade')).toEqual(['a'])
    expect(await ids('?q=KNOTLESS')).toEqual(['b'])
    expect(await ids('?q=lekki')).toEqual(['b'])
    expect(await ids('?q=ada')).toEqual(['b'])
  })

  it('serves a public profile or 404', async () => {
    sanity.on('_type == "stylist" && _id == $id', (p: { id: string }) => (p.id === 's1' ? { _id: 's1' } : null))
    expect(await json(await stylistById.GET(request('GET', '/'), params({ id: 's1' })))).toEqual({ status: 200, body: { _id: 's1' } })
    expect((await stylistById.GET(request('GET', '/'), params({ id: 'x' }))).status).toBe(404)
  })
})
