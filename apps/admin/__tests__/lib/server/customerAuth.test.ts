import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'
import { request } from '../../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/clerk', () => ({ requireClerkUser: vi.fn(), clerkIdentity: vi.fn() }))

const { requireCustomer, resolveCustomer } = await import('@/lib/server/customerAuth')
const { requireClerkUser, clerkIdentity } = await import('@/lib/server/clerk')

const BY_CLERK = 'clerkUserId == $clerkUserId'
const BY_EMAIL = 'lower(email) == $email'

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireClerkUser).mockResolvedValue('user_1')
})

describe('requireCustomer', () => {
  it('maps the Clerk user to their customer', async () => {
    sanity.on(BY_CLERK, { _id: 'c1', email: 'a@b.c', isActive: true })
    await expect(requireCustomer(request('GET', '/'))).resolves.toEqual({ customerId: 'c1', email: 'a@b.c', clerkUserId: 'user_1' })
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { clerkUserId: 'user_1' })
  })

  it('404s when there is no customer and 403s when deactivated', async () => {
    await expect(requireCustomer(request('GET', '/'))).rejects.toMatchObject({ status: 404 })
    sanity.on(BY_CLERK, { _id: 'c1', email: 'a@b.c', isActive: false })
    await expect(requireCustomer(request('GET', '/'))).rejects.toMatchObject({ status: 403 })
  })

  it('propagates token failures', async () => {
    vi.mocked(requireClerkUser).mockRejectedValue(Object.assign(new Error('x'), { status: 401 }))
    await expect(requireCustomer(request('GET', '/'))).rejects.toMatchObject({ status: 401 })
  })
})

describe('resolveCustomer', () => {
  it('returns an existing linked customer', async () => {
    sanity.on(BY_CLERK, { _id: 'c1' })
    await expect(resolveCustomer('user_1')).resolves.toEqual({ customerId: 'c1', outcome: 'existing' })
    expect(clerkIdentity).not.toHaveBeenCalled()
  })

  it('refuses a deactivated existing customer', async () => {
    sanity.on(BY_CLERK, { _id: 'c1', isActive: false })
    await expect(resolveCustomer('user_1')).rejects.toMatchObject({ status: 403 })
  })

  it('requires a verified email before creating anything', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: null, fullName: null })
    await expect(resolveCustomer('user_1')).rejects.toMatchObject({ status: 403 })
    expect(sanity.writes).toEqual([])
  })

  it('links a pre-Clerk account with the same email and drops the old password', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 'a@b.c', fullName: 'A' })
    sanity.on(BY_EMAIL, { _id: 'legacy', _rev: 'lr' })
    await expect(resolveCustomer('user_1')).resolves.toEqual({ customerId: 'legacy', outcome: 'linked' })
    expect(sanity.patches()).toEqual([expect.objectContaining({ id: 'legacy', ifRevisionId: 'lr', set: { clerkUserId: 'user_1' }, unset: ['password'] })])
  })

  it('refuses to link an account already tied to another Clerk user', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 'a@b.c', fullName: 'A' })
    sanity.on(BY_EMAIL, { _id: 'legacy', _rev: 'lr', clerkUserId: 'user_2' })
    await expect(resolveCustomer('user_1')).rejects.toMatchObject({ status: 409 })
  })

  it('creates a bronze customer with zero balances on first sign-in', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 'ada.o@cutty.app', fullName: 'Clerk Name' })
    const res = await resolveCustomer('user_1', { fullName: 'Ada Obi', phone: '08012345678' })
    expect(res).toEqual({ customerId: 'customer-user_1', outcome: 'created' })
    // createIfNotExists with a fixed id: concurrent first sign-ins make one account
    expect(sanity.writes[0].type).toBe('createIfNotExists')
    expect(sanity.creates()[0]).toMatchObject({
      _id: res.customerId, _type: 'customer', clerkUserId: 'user_1', uid: 'adaocuttyapp',
      fullName: 'Ada Obi', email: 'ada.o@cutty.app', phone: '08012345678',
      walletBalance: 0, loyaltyPoints: 0, totalVisits: 0, tier: 'bronze', isActive: true,
    })
  })

  it('falls back to the Clerk name, then the email local part', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u', email: 'ada@x.io', fullName: 'Clerk Name' })
    await resolveCustomer('u')
    expect(sanity.creates()[0].fullName).toBe('Clerk Name')

    sanity.reset()
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'u', email: 'ada@x.io', fullName: null })
    await resolveCustomer('u')
    expect(sanity.creates()[0].fullName).toBe('ada')
  })
})
