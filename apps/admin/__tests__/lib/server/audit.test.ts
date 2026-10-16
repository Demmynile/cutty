import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { audit } = await import('@/lib/server/audit')

beforeEach(() => {
  sanity.reset()
})

describe('audit', () => {
  it('writes a flattened auditLog document', async () => {
    await audit({
      action: 'wallet.topup',
      actor: { type: 'customer', id: 'c1', email: 'c@x' },
      target: { type: 'walletTransaction', id: 'w1' },
      ip: '1.2.3.4',
      details: { amount: 500 },
    })
    expect(sanity.creates()).toEqual([{
      _type: 'auditLog', action: 'wallet.topup', actorType: 'customer', actorId: 'c1', actorEmail: 'c@x',
      targetType: 'walletTransaction', targetId: 'w1', outcome: 'success', ip: '1.2.3.4',
      details: '{"amount":500}', createdAt: expect.any(String),
    }])
  })

  it('records failures and omits optional fields', async () => {
    await audit({ action: 'admin.login', actor: { type: 'system', id: 'x' }, outcome: 'failure' })
    expect(sanity.creates()[0]).toMatchObject({ outcome: 'failure', targetType: undefined, details: undefined })
  })

  it('never throws when the write fails', async () => {
    sanity.failNextCommit(new Error('sanity down'))
    await expect(audit({ action: 'x', actor: { type: 'system', id: 'x' } })).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
