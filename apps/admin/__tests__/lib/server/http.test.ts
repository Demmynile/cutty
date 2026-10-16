import { describe, expect, it, vi } from 'vitest'
import { z, ZodError } from 'zod'
import { HttpError, clientIp, parseBody, route } from '@/lib/server/http'
import { json, request } from '../../helpers/http'

describe('HttpError', () => {
  it('carries a status and message', () => {
    const err = new HttpError(418, 'teapot')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(418)
    expect(err.message).toBe('teapot')
  })
})

describe('parseBody', () => {
  const schema = z.object({ name: z.string().min(2) })

  it('returns parsed data for a valid body', async () => {
    await expect(parseBody(request('POST', '/', { name: 'Ada' }), schema)).resolves.toEqual({ name: 'Ada' })
  })

  it('rejects a body that fails the schema with a 400', async () => {
    await expect(parseBody(request('POST', '/', { name: 'A' }), schema)).rejects.toMatchObject({ status: 400, message: 'Invalid request body' })
  })

  it('rejects malformed JSON with a 400 instead of throwing a SyntaxError', async () => {
    await expect(parseBody(request('POST', '/', '{not json'), schema)).rejects.toBeInstanceOf(HttpError)
  })
})

describe('clientIp', () => {
  it('prefers the proxy-set x-real-ip over the client-controlled x-forwarded-for', () => {
    expect(clientIp(request('GET', '/', undefined, { 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4')
  })

  it('uses TRUSTED_IP_HEADER when configured', () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'CF-Connecting-IP')
    expect(clientIp(request('GET', '/', undefined, { 'cf-connecting-ip': '9.9.9.9', 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '6.6.6.6' }))).toBe('9.9.9.9')
  })

  it('uses the first x-forwarded-for hop', () => {
    expect(clientIp(request('GET', '/', undefined, { 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip, then "unknown"', () => {
    expect(clientIp(request('GET', '/', undefined, { 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8')
    expect(clientIp(request('GET', '/'))).toBe('unknown')
  })
})

describe('route', () => {
  it('passes through a successful response and the context', async () => {
    const handler = route<{ n: number }>(async (_req, ctx) => Response.json({ n: ctx.n }))
    expect(await json(await handler(request('GET', '/x'), { n: 7 }))).toEqual({ status: 200, body: { n: 7 } })
  })

  it('maps HttpError to its status and message', async () => {
    const handler = route(async () => { throw new HttpError(404, 'Nope') })
    expect(await json(await handler(request('GET', '/x'), {}))).toEqual({ status: 404, body: { error: 'Nope' } })
  })

  it('maps ZodError to a 400', async () => {
    const handler = route(async () => { throw new ZodError([]) })
    expect(await json(await handler(request('GET', '/x'), {}))).toEqual({ status: 400, body: { error: 'Invalid request body' } })
  })

  it('hides unexpected errors behind a generic 500', async () => {
    const handler = route(async () => { throw new Error('sanity token leaked in stack') })
    const res = await json(await handler(request('POST', '/api/thing'), {}))
    expect(res.status).toBe(500)
    expect(res.body.error).not.toContain('sanity')
    expect(console.error).toHaveBeenCalled()
  })
})
