import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conflict, sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { mutateCustomer, newId, orderNumber, tierForVisits } = await import('@/lib/server/ledger')

const customer = { _id: 'c1', _rev: 'r1', email: 'a@b.c', walletBalance: 5000, loyaltyPoints: 10, totalVisits: 2, tier: 'bronze' }

beforeEach(() => {
  sanity.reset()
})

describe('mutateCustomer', () => {
  it('commits the customer patch conditionally on the revision read, plus creates and patches', async () => {
    sanity.on('_type == "customer"', customer)
    const result = await mutateCustomer('c1', (c) => ({
      set: { walletBalance: c.walletBalance - 1000 },
      create: [{ _type: 'walletTransaction', amount: 1000 }],
      patch: [{ id: 'd1', rev: 'dr1', set: { usedCount: 1 } }, { id: 'o1', set: { status: 'paid' } }],
      result: 'done',
    }))

    expect(result).toBe('done')
    expect(sanity.writes).toHaveLength(1)
    const [tx] = sanity.writes
    expect(tx.type).toBe('transaction')
    if (tx.type !== 'transaction') return
    expect(tx.patches[0]).toMatchObject({ id: 'c1', ifRevisionId: 'r1', set: { walletBalance: 4000 } })
    expect(tx.patches[1]).toMatchObject({ id: 'd1', ifRevisionId: 'dr1', set: { usedCount: 1 } })
    expect(tx.patches[2].ifRevisionId).toBeUndefined()
    expect(tx.creates[0]).toMatchObject({ _type: 'walletTransaction', amount: 1000, _id: expect.any(String) })
  })

  it('retries against fresh balances after a revision conflict', async () => {
    sanity.once('_type == "customer"', customer)
    sanity.once('_type == "customer"', { ...customer, _rev: 'r2', walletBalance: 3000 })
    sanity.failNextCommit(conflict())

    const seen: number[] = []
    await mutateCustomer('c1', (c) => {
      seen.push(c.walletBalance)
      return { set: { walletBalance: c.walletBalance - 1000 }, result: null }
    })

    expect(seen).toEqual([5000, 3000])
    expect(sanity.patches()[0]).toMatchObject({ ifRevisionId: 'r2', set: { walletBalance: 2000 } })
  })

  it('gives up with a 409 after five conflicts', async () => {
    sanity.on('_type == "customer"', customer)
    for (let i = 0; i < 5; i++) sanity.failNextCommit(conflict())
    await expect(mutateCustomer('c1', () => ({ result: null }))).rejects.toMatchObject({ status: 409 })
    expect(sanity.client.fetch).toHaveBeenCalledTimes(5)
  })

  it('rethrows non-conflict errors immediately', async () => {
    sanity.on('_type == "customer"', customer)
    sanity.failNextCommit(new Error('network'))
    await expect(mutateCustomer('c1', () => ({ result: null }))).rejects.toThrow('network')
    expect(sanity.client.fetch).toHaveBeenCalledTimes(1)
  })

  it('404s for a missing or inactive customer', async () => {
    await expect(mutateCustomer('nobody', () => ({ result: null }))).rejects.toMatchObject({ status: 404 })
  })

  it('propagates errors thrown by the plan (e.g. insufficient funds) without writing', async () => {
    sanity.on('_type == "customer"', customer)
    await expect(mutateCustomer('c1', () => { throw new Error('no funds') })).rejects.toThrow('no funds')
    expect(sanity.writes).toHaveLength(0)
  })
})

describe('tierForVisits', () => {
  it.each([
    [0, 'bronze'], [4, 'bronze'], [5, 'silver'], [14, 'silver'], [15, 'gold'], [29, 'gold'], [30, 'platinum'], [500, 'platinum'],
  ])('%i visits → %s', (visits, tier) => {
    expect(tierForVisits(visits)).toBe(tier)
  })
})

describe('ids', () => {
  it('newId returns unique UUIDs', () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/)
    expect(newId()).not.toBe(newId())
  })

  it('orderNumber has the CUT-<time>-<rand> shape', () => {
    expect(orderNumber()).toMatch(/^CUT-[0-9A-Z]+-[0-9A-F]{4}$/)
  })
})
