import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { bonusGivenThisMonth, customerStats, dashboard, marketplaceSettings, monthStart } = await import('@/lib/server/stylistStats')

const raw = {
  completed: [
    { customerId: 'c1', amount: 5000, date: '2026-05-01' },
    { customerId: 'c1', amount: 7000, date: '2026-06-01' },
    { customerId: 'c2', amount: 3000, date: '2026-04-01' },
  ],
  sales: [
    { customerId: 'c2', amount: 20000, qty: 3, createdAt: '2026-06-02' },
    { customerId: 'c3', amount: 1000, qty: undefined, createdAt: '2026-06-03' },
  ],
  bonuses: [
    { customerId: 'c1', points: 50, createdAt: '2026-06-01' },
    { customerId: 'ghost', points: 10, createdAt: '2026-06-01' },
  ],
  customers: [
    { _id: 'c1', fullName: 'Ada', tier: 'gold' },
    { _id: 'c2', fullName: 'Bola' },
  ],
}

beforeEach(() => {
  sanity.reset()
  vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('monthStart', () => {
  it('is the first of the current Lagos month', () => {
    expect(monthStart()).toBe('2026-06-01T00:00:00Z')
    vi.setSystemTime(new Date('2026-06-30T23:30:00Z')) // already July in Lagos
    expect(monthStart()).toBe('2026-07-01T00:00:00Z')
  })
})

describe('marketplaceSettings', () => {
  it('uses Studio values with sensible defaults', async () => {
    expect(await marketplaceSettings()).toEqual({ commissionPercent: 10, bonusMaxPerAward: 200, bonusMonthlyCap: 2000, bookingPointsMaxPerVisit: 300, bookingPointsMonthlyCap: 5000 })
    sanity.on('.marketplace', { commissionPercent: 15, bonusMonthlyCap: 500, bookingPointsMaxPerVisit: 100 })
    expect(await marketplaceSettings()).toMatchObject({ commissionPercent: 15, bonusMaxPerAward: 200, bonusMonthlyCap: 500, bookingPointsMaxPerVisit: 100, bookingPointsMonthlyCap: 5000 })
  })
})

describe('bonusGivenThisMonth', () => {
  it('sums bonus points since the month started', async () => {
    sanity.on('type == "bonus" && createdAt >= $since', 120)
    expect(await bonusGivenThisMonth('s1')).toBe(120)
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { stylistId: 's1', since: '2026-06-01T00:00:00Z' })
  })
})

describe('customerStats', () => {
  it('aggregates visits, spend, products and bonuses per customer, busiest first', async () => {
    sanity.on('"completed"', raw)
    const stats = await customerStats('s1', 'b1')
    expect(stats.map((s) => s.customerId)).toEqual(['c1', 'c2', 'c3'])
    expect(stats[0]).toMatchObject({ name: 'Ada', tier: 'gold', visits: 2, totalSpent: 12000, lastVisit: '2026-06-01', bonusGiven: 50, productsPurchased: 0 })
    expect(stats[1]).toMatchObject({ name: 'Bola', tier: 'bronze', visits: 1, totalSpent: 23000, productsPurchased: 3 })
    expect(stats[2]).toMatchObject({ name: 'Customer', visits: 0, productsPurchased: 0, totalSpent: 1000 })
  })

  it('uses a placeholder barber id for stylists without a bookable profile', async () => {
    sanity.on('"completed"', { completed: [], sales: [], bonuses: [], customers: [] })
    await customerStats('s1')
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ barberId: '__none__' }))
  })
})

describe('dashboard', () => {
  it('rolls up totals, upcoming bookings and pending sales', async () => {
    sanity.on('"completed"', raw)
    sanity.on('bookingDate >= $today', [{ _id: 'bk1' }, { _id: 'bk2' }])
    sanity.on('status in ["pending", "paid"]', [{ _id: 'o1' }])
    sanity.on('type == "bonus" && createdAt >= $since', 300)

    const d = await dashboard({ stylistId: 's1', barberId: 'b1', status: 'approved', shopStatus: 'approved' })
    expect(d.totals).toEqual({
      customers: 3, visits: 3, productsSold: 3, revenueBookings: 15000, revenueProducts: 21000,
      pendingSales: 1, upcomingBookings: 2, bonusPointsThisMonth: 300, bonusMonthlyCap: 2000,
    })
    expect(d.upcoming).toHaveLength(2)
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.stringContaining('bookingDate >= $today'), { barberId: 'b1', today: '2026-06-15' })
  })

  it('skips the bookings query for stylists without a barber', async () => {
    sanity.on('"completed"', { completed: [], sales: [], bonuses: [], customers: [] })
    sanity.on('status in ["pending", "paid"]', [])
    sanity.on('type == "bonus" && createdAt >= $since', 0)
    const d = await dashboard({ stylistId: 's1', status: 'pending', shopStatus: 'none' })
    expect(d.upcoming).toEqual([])
    expect(sanity.client.fetch.mock.calls.some(([q]) => q.includes('bookingDate >= $today'))).toBe(false)
  })
})
