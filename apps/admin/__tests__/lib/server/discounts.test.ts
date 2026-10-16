import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { consumeDiscount, discountAmount, loadDiscount } = await import('@/lib/server/discounts')

const base = { _id: 'd1', _rev: 'r1', code: 'SAVE10', type: 'percentage' as const, value: 10, applicableTo: 'both' as const }

beforeEach(() => {
  sanity.reset()
  vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('loadDiscount', () => {
  it('normalises the code and returns the computed amount', async () => {
    sanity.on('_type == "discountCode"', (p: { code: string }) => (p.code === 'SAVE10' ? base : null))
    await expect(loadDiscount('  save10 ', 'order', 20_000, 'c1')).resolves.toEqual({ doc: base, amount: 2_000 })
  })

  it.each([
    ['unknown code', null, 'order', /not found/],
    ['booking-only code on an order', { ...base, applicableTo: 'booking' }, 'order', /only valid for bookings/],
    ['order-only code on a booking', { ...base, applicableTo: 'order' }, 'booking', /only valid for product orders/],
    ['not yet active', { ...base, validFrom: '2026-07-01T00:00:00Z' }, 'order', /not active yet/],
    ['expired', { ...base, validUntil: '2026-06-01T00:00:00Z' }, 'order', /expired/],
    ['used up', { ...base, maxUses: 2, usedCount: 2 }, 'order', /usage limit/],
    ["someone else's code", { ...base, customerId: 'c2' }, 'order', /not valid for your account/],
    ['below minimum', { ...base, minOrderAmount: 50_000 }, 'order', /Minimum amount/],
  ] as const)('rejects %s with a 400', async (_label, doc, context, message) => {
    sanity.on('_type == "discountCode"', doc)
    await expect(loadDiscount('SAVE10', context, 20_000, 'c1')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(message) })
  })

  it('accepts a code within its validity window bound to this customer', async () => {
    sanity.on('_type == "discountCode"', { ...base, customerId: 'c1', validFrom: '2026-06-01T00:00:00Z', validUntil: '2026-07-01T00:00:00Z', maxUses: 1, usedCount: 0 })
    await expect(loadDiscount('SAVE10', 'booking', 10_000, 'c1')).resolves.toMatchObject({ amount: 1_000 })
  })
})

describe('discountAmount', () => {
  it('rounds percentages', () => {
    expect(discountAmount({ type: 'percentage', value: 15 }, 333)).toBe(50)
  })

  it('caps percentages at maxDiscountAmount', () => {
    expect(discountAmount({ type: 'percentage', value: 50, maxDiscountAmount: 1_000 }, 10_000)).toBe(1_000)
  })

  it('never exceeds the subtotal', () => {
    expect(discountAmount({ type: 'percentage', value: 150 }, 1_000)).toBe(1_000)
    expect(discountAmount({ type: 'fixed', value: 5_000 }, 1_000)).toBe(1_000)
  })

  it('applies fixed amounts as-is', () => {
    expect(discountAmount({ type: 'fixed', value: 500 }, 1_000)).toBe(500)
  })
})

describe('consumeDiscount', () => {
  it('increments usedCount conditional on the validated revision', () => {
    expect(consumeDiscount({ ...base, usedCount: 4 })).toEqual({ id: 'd1', rev: 'r1', set: { usedCount: 5 } })
    expect(consumeDiscount(base).set.usedCount).toBe(1)
  })
})
