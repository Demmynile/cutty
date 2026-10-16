import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, middleware } from '@/middleware'
import { signSession } from '@/lib/server/session'

async function visit(path: string, token?: string) {
  const req = new NextRequest(`http://localhost${path}`, { headers: token ? { cookie: `cutty_admin=${token}` } : {} })
  return middleware(req)
}

const validToken = () => signSession({ sub: 'a1', typ: 'admin', ver: 0 }, 60)

describe('middleware', () => {
  it('redirects signed-out visitors to /login', async () => {
    const res = await visit('/dashboard')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login')
  })

  it('clears an invalid cookie while redirecting', async () => {
    const res = await visit('/orders', 'tampered')
    expect(res.headers.get('location')).toBe('http://localhost/login')
    expect(res.headers.get('set-cookie')).toMatch(/cutty_admin=;.*Expires=Thu, 01 Jan 1970/)
  })

  it('lets a valid session through', async () => {
    const res = await visit('/orders', await validToken())
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('shows /login to signed-out visitors and sends signed-in admins to the dashboard', async () => {
    expect((await visit('/login')).headers.get('x-middleware-next')).toBe('1')
    expect((await visit('/login', await validToken())).headers.get('location')).toBe('http://localhost/dashboard')
  })

  it('does not run on API routes or static assets', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    for (const p of ['/api/v1/me', '/api/ai/chat', '/_next/static/x.js', '/_next/image', '/favicon.ico', '/robots.txt']) {
      expect(matcher.test(p)).toBe(false)
    }
    for (const p of ['/dashboard', '/login', '/stylists']) expect(matcher.test(p)).toBe(true)
  })
})
