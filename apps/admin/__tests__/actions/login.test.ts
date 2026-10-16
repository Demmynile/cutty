import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'

const jar = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), headers: new Map<string, string>() }))

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: jar.set, delete: jar.delete, get: () => undefined }),
  headers: async () => ({ get: (k: string) => jar.headers.get(k) ?? null }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) }),
}))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/totp', () => ({ matchTotp: vi.fn() }))
vi.mock('@/lib/server/adminAuth', () => ({ getAdmin: vi.fn() }))
vi.mock('@/lib/server/password', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/password')>()),
  verifyDummy: vi.fn(),
}))

const { login, logout } = await import('@/app/(auth)/login/actions')
const { hashPassword, verifyDummy } = await import('@/lib/server/password')
const { matchTotp } = await import('@/lib/server/totp')
const { audit } = await import('@/lib/server/audit')
const { getAdmin } = await import('@/lib/server/adminAuth')
const { verifySession } = await import('@/lib/server/session')
const { resetRateLimit } = await import('@/lib/server/rateLimit')

const GENERIC = 'Invalid email, password or authenticator code.'
const PASSWORD = 'correct horse battery'
const passwordHash = await hashPassword(PASSWORD)

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

let seq = 0
const creds = () => ({ email: `owner${++seq}@cutty.app`, password: PASSWORD, code: '123456' })
const admin = (email: string, over: object = {}) => ({ _id: 'a1', _rev: 'ar1', email, name: 'Owner', role: 'owner', passwordHash, totpSecret: 'SECRET', isActive: true, sessionVersion: 4, ...over })

beforeEach(() => {
  sanity.reset()
  jar.headers.clear()
  jar.headers.set('x-forwarded-for', `10.0.0.${seq}`)
  vi.mocked(matchTotp).mockReturnValue(1000)
})

describe('login', () => {
  it('sets a strict httpOnly session cookie, audits and redirects', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email))
    await expect(login(undefined, form(c))).rejects.toMatchObject({ url: '/dashboard' })

    const [name, token, opts] = jar.set.mock.calls[0]
    expect(name).toBe('cutty_admin')
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 })
    expect(await verifySession(token, 'admin')).toMatchObject({ sub: 'a1', ver: 4, role: 'owner' })
    expect(sanity.patches()).toEqual([expect.objectContaining({ id: 'a1', ifRevisionId: 'ar1', set: expect.objectContaining({ totpLastStep: 1000, lastLoginAt: expect.any(String) }) })])
    expect(audit).toHaveBeenCalledWith({ action: 'admin.login', actor: { type: 'admin', id: 'a1', email: c.email }, ip: expect.any(String) })
  })

  it('normalises the email before lookup', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email))
    await login(undefined, form({ ...c, email: `  ${c.email.toUpperCase()} ` })).catch(() => {})
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { email: c.email })
  })

  it('upgrades a legacy password hash on success', async () => {
    const c = creds()
    const { createHash } = await import('node:crypto')
    const legacy = createHash('sha256').update(`cutty-mobile-v1:${PASSWORD}`).digest('hex')
    sanity.on('_type == "adminUser"', admin(c.email, { passwordHash: legacy }))
    await login(undefined, form(c)).catch(() => {})
    expect(sanity.patches()[0].set.passwordHash).toMatch(/^scrypt\$/)
  })

  it.each([
    ['an unknown email', null, 'no_account'],
    ['an inactive admin', { isActive: false }, 'inactive'],
  ])('returns the generic error for %s and burns comparable time', async (_l, row, reason) => {
    const c = creds()
    if (row) sanity.on('_type == "adminUser"', admin(c.email, row))
    await expect(login(undefined, form(c))).resolves.toEqual({ error: GENERIC })
    expect(verifyDummy).toHaveBeenCalledWith(PASSWORD)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failure', details: { reason } }))
    expect(jar.set).not.toHaveBeenCalled()
  })

  it('rejects a wrong password or authenticator code with the same message', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email))
    await expect(login(undefined, form({ ...c, password: 'wrong' }))).resolves.toEqual({ error: GENERIC })
    vi.mocked(matchTotp).mockReturnValue(null)
    await expect(login(undefined, form(c))).resolves.toEqual({ error: GENERIC })
    expect(vi.mocked(audit).mock.calls.map(([e]) => e.details)).toEqual([{ reason: 'bad_password' }, { reason: 'bad_totp' }])
  })

  it('refuses an authenticator code that was already used (replay)', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email, { totpLastStep: 1000 }))
    await expect(login(undefined, form(c))).resolves.toEqual({ error: GENERIC })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ details: { reason: 'totp_reused' } }))
    expect(jar.set).not.toHaveBeenCalled()
  })

  it('accepts the next code after a previous login', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email, { totpLastStep: 999 }))
    await expect(login(undefined, form(c))).rejects.toMatchObject({ url: '/dashboard' })
  })

  it('lets only one of two logins racing with the same code through', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email))
    sanity.failNextCommit(Object.assign(new Error('rev mismatch'), { statusCode: 409 }))
    await expect(login(undefined, form(c))).resolves.toEqual({ error: GENERIC })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ details: { reason: 'totp_race' } }))
    expect(jar.set).not.toHaveBeenCalled()
  })

  it('requires an enrolled authenticator', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email, { totpSecret: undefined }))
    await expect(login(undefined, form(c))).resolves.toEqual({ error: GENERIC })
    expect(matchTotp).not.toHaveBeenCalled()
  })

  it('rejects malformed input without touching the database', async () => {
    await expect(login(undefined, form({ email: 'nope', password: 'x', code: '123456' }))).resolves.toEqual({ error: GENERIC })
    await expect(login(undefined, form({ ...creds(), code: '12345' }))).resolves.toEqual({ error: GENERIC })
    expect(sanity.client.fetch).not.toHaveBeenCalled()
  })

  it('locks an account after 5 attempts in 15 minutes', async () => {
    const c = creds()
    sanity.on('_type == "adminUser"', admin(c.email))
    for (let i = 0; i < 5; i++) await login(undefined, form({ ...c, password: 'wrong' }))
    expect((await login(undefined, form(c))).error).toMatch(/Too many requests/)
    await resetRateLimit(`admin-login:acct:${c.email}`)
  })
})

describe('logout', () => {
  it('clears the cookie, revokes the token, audits and redirects to /login', async () => {
    vi.mocked(getAdmin).mockResolvedValue({ id: 'a1', email: 'o@c', name: 'O', role: 'owner' })
    await expect(logout()).rejects.toMatchObject({ url: '/login' })
    expect(jar.delete).toHaveBeenCalledWith('cutty_admin')
    expect(sanity.patches()).toEqual([expect.objectContaining({ id: 'a1', setIfMissing: { sessionVersion: 0 }, inc: { sessionVersion: 1 } })])
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.logout' }))
  })

  it('still clears the cookie when the session was already invalid', async () => {
    vi.mocked(getAdmin).mockResolvedValue(null)
    await expect(logout()).rejects.toMatchObject({ url: '/login' })
    expect(jar.delete).toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
})
