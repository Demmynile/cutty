import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { markOrderPaid } = await import('@/lib/server/orders')

const order = { _id: 'o1', _rev: 'or1', orderNumber: 'CUT-1', customerId: 'c1', pointsEarned: 40 }

beforeEach(() => {
  sanity.reset()
  sanity.on('_type == "customer"', { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 0, loyaltyPoints: 10, totalVisits: 0, tier: 'bronze' })
})

describe('markOrderPaid', () => {
  it('marks the order paid (conditionally) and credits its points in one transaction', async () => {
    await markOrderPaid(order, { markedPaidBy: 'owner@cutty.app' })
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.patches[0].set).toEqual({ loyaltyPoints: 50 })
    expect(tx.patches[1]).toMatchObject({ id: 'o1', ifRevisionId: 'or1', set: { status: 'paid', paidAt: expect.any(String), markedPaidBy: 'owner@cutty.app' } })
    expect(tx.creates).toEqual([expect.objectContaining({ type: 'earn', points: 40, balanceAfter: 50, description: 'Points from Order #CUT-1', source: 'order' })])
  })

  it('skips the loyalty record when the order earns no points', async () => {
    await markOrderPaid({ ...order, pointsEarned: undefined }, {})
    expect(sanity.creates()).toEqual([])
    expect(sanity.patches()[0].set).toEqual({ loyaltyPoints: 10 })
  })
})
