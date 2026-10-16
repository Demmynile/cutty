import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'
import { request } from '../../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/clerk', () => ({ requireClerkUser: vi.fn(), clerkIdentity: vi.fn() }))

const { findStylist, requireStylist } = await import('@/lib/server/stylistAuth')
const { requireClerkUser, clerkIdentity } = await import('@/lib/server/clerk')

const BY_CLERK = 'clerkUserId == $clerkUserId'
const BY_EMAIL = 'lower(email) == $email'
const req = () => request('GET', '/')

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireClerkUser).mockResolvedValue('user_1')
})

describe('requireStylist', () => {
  it('returns the session with defaults for status and shop', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x' })
    await expect(requireStylist(req())).resolves.toEqual({ stylistId: 's1', email: 's@x', status: 'pending', shopStatus: 'none', barberId: undefined })
  })

  it('404s without a stylist, 403s when deactivated or suspended', async () => {
    await expect(requireStylist(req())).rejects.toMatchObject({ status: 404 })
    sanity.reset()
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', isActive: false })
    await expect(requireStylist(req())).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/deactivated/) })
    sanity.reset()
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', status: 'suspended' })
    await expect(requireStylist(req())).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/suspended/) })
  })

  it('enforces approval when asked', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', status: 'pending' })
    await expect(requireStylist(req(), { approved: true })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/under review/) })
    await expect(requireStylist(req(), { shop: true })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/under review/) })
  })

  it('enforces an approved shop when asked', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', status: 'approved', shopStatus: 'requested', barberId: 'b1' })
    await expect(requireStylist(req(), { approved: true })).resolves.toMatchObject({ barberId: 'b1', shopStatus: 'requested' })
    await expect(requireStylist(req(), { shop: true })).rejects.toMatchObject({ status: 403, message: expect.stringMatching(/shop/) })
  })

  it('passes a fully approved stylist with a shop', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', status: 'approved', shopStatus: 'approved' })
    await expect(requireStylist(req(), { shop: true })).resolves.toMatchObject({ status: 'approved', shopStatus: 'approved' })
  })
})

describe('findStylist', () => {
  it('returns an existing linked stylist', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x' })
    await expect(findStylist('user_1')).resolves.toEqual({ stylistId: 's1', linked: false })
  })

  it('refuses a deactivated stylist', async () => {
    sanity.on(BY_CLERK, { _id: 's1', email: 's@x', isActive: false })
    await expect(findStylist('user_1')).rejects.toMatchObject({ status: 403 })
  })

  it('returns null when the email is unverified or matches nobody', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: null, fullName: null })
    await expect(findStylist('user_1')).resolves.toBeNull()
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 's@x', fullName: null })
    await expect(findStylist('user_1')).resolves.toBeNull()
  })

  it('links a legacy stylist by email', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 's@x', fullName: null })
    sanity.on(BY_EMAIL, { _id: 'legacy', _rev: 'r' })
    await expect(findStylist('user_1')).resolves.toEqual({ stylistId: 'legacy', linked: true })
    expect(sanity.patches()[0]).toMatchObject({ id: 'legacy', ifRevisionId: 'r', set: { clerkUserId: 'user_1' }, unset: ['password'] })
  })

  it('409s for a legacy stylist owned by another Clerk user', async () => {
    vi.mocked(clerkIdentity).mockResolvedValue({ clerkUserId: 'user_1', email: 's@x', fullName: null })
    sanity.on(BY_EMAIL, { _id: 'legacy', _rev: 'r', clerkUserId: 'user_9' })
    await expect(findStylist('user_1')).rejects.toMatchObject({ status: 409 })
  })
})
