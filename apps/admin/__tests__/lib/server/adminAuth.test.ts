import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

const cookieJar = vi.hoisted(() => new Map<string, string>())

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) }),
}))

const { getAdmin, requireAdmin } = await import('@/lib/server/adminAuth')
const { signSession, ADMIN_COOKIE } = await import('@/lib/server/session')

const row = { _id: 'a1', email: 'owner@cutty.app', name: 'Owner', role: 'owner', isActive: true, sessionVersion: 2 }

async function signIn(ver = 2) {
  cookieJar.set(ADMIN_COOKIE, await signSession({ sub: 'a1', typ: 'admin', ver }, 60))
}

beforeEach(() => {
  sanity.reset()
  cookieJar.clear()
})

describe('getAdmin', () => {
  it('returns null without a cookie or with an invalid token', async () => {
    expect(await getAdmin()).toBeNull()
    cookieJar.set(ADMIN_COOKIE, 'garbage')
    expect(await getAdmin()).toBeNull()
  })

  it('returns the admin when the token and database agree', async () => {
    sanity.on('_type == "adminUser"', row)
    await signIn()
    expect(await getAdmin()).toEqual({ id: 'a1', email: 'owner@cutty.app', name: 'Owner', role: 'owner' })
  })

  it('rejects a token from before the session version was bumped', async () => {
    sanity.on('_type == "adminUser"', row)
    await signIn(1)
    expect(await getAdmin()).toBeNull()
  })

  it('rejects deactivated or deleted admins', async () => {
    await signIn()
    expect(await getAdmin()).toBeNull()
    sanity.on('_type == "adminUser"', { ...row, isActive: false })
    expect(await getAdmin()).toBeNull()
  })

  it('treats a missing sessionVersion as 0', async () => {
    sanity.on('_type == "adminUser"', { ...row, sessionVersion: undefined })
    await signIn(0)
    expect(await getAdmin()).not.toBeNull()
  })
})

describe('requireAdmin', () => {
  it('redirects to /login when signed out', async () => {
    await expect(requireAdmin()).rejects.toMatchObject({ url: '/login' })
  })

  it('enforces the owner role when asked', async () => {
    sanity.on('_type == "adminUser"', { ...row, role: 'staff' })
    await signIn()
    await expect(requireAdmin()).resolves.toMatchObject({ role: 'staff' })
    await expect(requireAdmin('owner')).rejects.toThrow('Forbidden')
  })
})
