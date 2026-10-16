import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))

const { BOOKING_TRANSITIONS, changeBookingStatus } = await import('@/lib/server/bookings')
const { audit } = await import('@/lib/server/audit')

// Only the booked stylist changes a booking's status (from the Cutty Pro app).
const stylist = { type: 'stylist' as const, id: 's1' }
const booking = (status: string, extra: object = {}) => ({ _id: 'bk1', _rev: 'r1', status, customerId: 'c1', barberId: 'b1', pointsEarned: 25, ...extra })

beforeEach(() => {
  sanity.reset()
})

describe('BOOKING_TRANSITIONS', () => {
  it('only lets terminal states stay terminal', () => {
    expect(BOOKING_TRANSITIONS.completed).toEqual([])
    expect(BOOKING_TRANSITIONS.cancelled).toEqual([])
    expect(BOOKING_TRANSITIONS.no_show).toEqual([])
    expect(BOOKING_TRANSITIONS.in_progress).toEqual(['completed'])
  })
})

describe('changeBookingStatus', () => {
  it('moves along an allowed transition with a conditional patch and audits it', async () => {
    sanity.on('_type == "booking"', booking('pending'))
    await expect(changeBookingStatus({ bookingId: 'bk1', status: 'confirmed', actor: stylist, barberId: 'b1' })).resolves.toEqual({ ok: true })
    expect(sanity.patches()).toEqual([expect.objectContaining({ id: 'bk1', ifRevisionId: 'r1', set: { status: 'confirmed' } })])
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'stylist.booking_status', actor: stylist, details: { from: 'pending', to: 'confirmed' } }))
  })

  it('refuses a disallowed transition with a readable error', async () => {
    sanity.on('_type == "booking"', booking('in_progress'))
    await expect(changeBookingStatus({ bookingId: 'bk1', status: 'cancelled', actor: stylist, barberId: 'b1' }))
      .resolves.toEqual({ ok: false, error: "Can't move a in progress booking to cancelled" })
    expect(sanity.writes).toHaveLength(0)
  })

  it('hides bookings belonging to another barber', async () => {
    sanity.on('_type == "booking"', booking('pending', { barberId: 'other' }))
    await expect(changeBookingStatus({ bookingId: 'bk1', status: 'confirmed', actor: stylist, barberId: 'b1' }))
      .resolves.toEqual({ ok: false, error: 'Booking not found' })
  })

  it('reports a missing booking', async () => {
    await expect(changeBookingStatus({ bookingId: 'nope', status: 'confirmed', actor: stylist, barberId: 'b1' })).resolves.toMatchObject({ ok: false })
  })

  it('completing credits points, a visit and the new tier in one transaction', async () => {
    sanity.on('_type == "booking"', booking('in_progress'))
    sanity.on('_type == "customer"', { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 0, loyaltyPoints: 100, totalVisits: 4, tier: 'bronze' })

    await changeBookingStatus({ bookingId: 'bk1', status: 'completed', actor: { type: 'stylist', id: 's1' }, barberId: 'b1' })

    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.patches[0]).toMatchObject({ id: 'c1', ifRevisionId: 'cr', set: { loyaltyPoints: 125, totalVisits: 5, tier: 'silver' } })
    expect(tx.patches[1]).toMatchObject({ id: 'bk1', ifRevisionId: 'r1', set: { status: 'completed', completedAt: expect.any(String) } })
    expect(tx.creates).toEqual([expect.objectContaining({ _type: 'loyaltyTransaction', points: 25, balanceAfter: 125, referenceId: 'bk1' })])
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'stylist.booking_status' }))
  })

  it('completing a zero-point booking still counts the visit but writes no loyalty record', async () => {
    sanity.on('_type == "booking"', booking('in_progress', { pointsEarned: undefined }))
    sanity.on('_type == "customer"', { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 0, loyaltyPoints: 0, totalVisits: 0, tier: 'bronze' })
    await changeBookingStatus({ bookingId: 'bk1', status: 'completed', actor: stylist, barberId: 'b1' })
    expect(sanity.creates()).toEqual([])
    expect(sanity.patches()[0].set).toMatchObject({ totalVisits: 1 })
  })

  describe('points from bookings a stylist completes are capped', () => {
    const customer = { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 0, loyaltyPoints: 0, totalVisits: 0, tier: 'bronze' }

    it('per visit, so an inflated appointment price cannot mint points', async () => {
      sanity.on('_type == "booking"', booking('in_progress', { pointsEarned: 10_000 }))
      sanity.on('_type == "customer"', customer)
      await changeBookingStatus({ bookingId: 'bk1', status: 'completed', actor: stylist, barberId: 'b1' })
      expect(sanity.creates()[0]).toMatchObject({ points: 300, stylist: { _ref: 's1' }, source: 'booking' })
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ pointsCapped: { from: 10_000, to: 300 } }) }))
    })

    it('per month, across all of the stylist’s completions', async () => {
      sanity.on('_type == "booking"', booking('in_progress', { pointsEarned: 250 }))
      sanity.on('_type == "customer"', customer)
      sanity.on('source == "booking" && createdAt >= $since', 4_900)
      await changeBookingStatus({ bookingId: 'bk1', status: 'completed', actor: stylist, barberId: 'b1' })
      expect(sanity.creates()[0]).toMatchObject({ points: 100 })
    })

    it('awards nothing once the monthly allowance is used up, but still counts the visit', async () => {
      sanity.on('_type == "booking"', booking('in_progress', { pointsEarned: 50 }))
      sanity.on('_type == "customer"', customer)
      sanity.on('source == "booking" && createdAt >= $since', 5_000)
      await changeBookingStatus({ bookingId: 'bk1', status: 'completed', actor: stylist, barberId: 'b1' })
      expect(sanity.creates()).toEqual([])
      expect(sanity.patches()[0].set).toMatchObject({ loyaltyPoints: 0, totalVisits: 1 })
    })
  })
})
