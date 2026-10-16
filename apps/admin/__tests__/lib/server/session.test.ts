import { SignJWT } from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, signSession, verifySession } from '@/lib/server/session'

const key = () => new TextEncoder().encode(process.env.AUTH_JWT_SECRET)

afterEach(() => {
  vi.useRealTimers()
})

describe('admin session tokens', () => {
  it('exposes the cookie name and an 8 hour lifetime', () => {
    expect(ADMIN_COOKIE).toBe('cutty_admin')
    expect(ADMIN_SESSION_SECONDS).toBe(8 * 60 * 60)
  })

  it('round-trips claims', async () => {
    const token = await signSession({ sub: 'admin-1', typ: 'admin', ver: 3, role: 'owner' }, 60)
    expect(await verifySession(token, 'admin')).toEqual({ sub: 'admin-1', typ: 'admin', ver: 3, role: 'owner' })
  })

  it('omits role when not given', async () => {
    const token = await signSession({ sub: 'admin-2', typ: 'admin', ver: 0 }, 60)
    expect((await verifySession(token, 'admin'))?.role).toBeUndefined()
  })

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    const token = await signSession({ sub: 'a', typ: 'admin', ver: 0 }, 60)
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    expect(await verifySession(token, 'admin')).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const forged = await new SignJWT({ typ: 'admin', ver: 0 })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('a').setIssuer('cutty').setAudience('admin').setExpirationTime('1h')
      .sign(new TextEncoder().encode('another-secret-another-secret-another-secret'))
    expect(await verifySession(forged, 'admin')).toBeNull()
  })

  it('rejects a token for another audience or with a mismatched typ claim', async () => {
    const wrongAud = await new SignJWT({ typ: 'admin', ver: 0 })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('a').setIssuer('cutty').setAudience('customer').setExpirationTime('1h').sign(key())
    expect(await verifySession(wrongAud, 'admin')).toBeNull()

    const wrongTyp = await new SignJWT({ typ: 'customer', ver: 0 })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('a').setIssuer('cutty').setAudience('admin').setExpirationTime('1h').sign(key())
    expect(await verifySession(wrongTyp, 'admin')).toBeNull()
  })

  it('defaults a missing ver claim to 0', async () => {
    const token = await new SignJWT({ typ: 'admin' })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('a').setIssuer('cutty').setAudience('admin').setExpirationTime('1h').sign(key())
    expect((await verifySession(token, 'admin'))?.ver).toBe(0)
  })

  it('returns null for garbage', async () => {
    expect(await verifySession('not.a.jwt', 'admin')).toBeNull()
  })

  it('refuses to sign with a short or missing secret', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', 'short')
    await expect(signSession({ sub: 'a', typ: 'admin', ver: 0 }, 60)).rejects.toThrow(/AUTH_JWT_SECRET/)
  })
})
