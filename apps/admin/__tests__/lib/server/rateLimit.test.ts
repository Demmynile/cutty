import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeRedis } from '../../helpers/redis'

const r = { current: null as ReturnType<typeof fakeRedis> | null }
vi.mock('@/lib/server/redis', () => ({ redis: () => r.current?.client ?? null }))

const { rateLimit, resetRateLimit } = await import('@/lib/server/rateLimit')

afterEach(() => {
  vi.useRealTimers()
  r.current = null
})

const tooMany = expect.objectContaining({ status: 429 })

describe('rateLimit (in process, no REDIS_URL)', () => {
  it('allows up to the limit, then throws 429', async () => {
    const key = `t:${Math.random()}`
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 1000)
    await expect(rateLimit(key, 3, 1000)).rejects.toEqual(tooMany)
  })

  it('keeps separate counters per key', async () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    await rateLimit(a, 1, 1000)
    await expect(rateLimit(b, 1, 1000)).resolves.toBeUndefined()
    await expect(rateLimit(a, 1, 1000)).rejects.toEqual(tooMany)
  })

  it('opens a fresh window once the old one expires', async () => {
    vi.useFakeTimers()
    const key = `w:${Math.random()}`
    await rateLimit(key, 1, 1000)
    await expect(rateLimit(key, 1, 1000)).rejects.toEqual(tooMany)
    vi.advanceTimersByTime(1001)
    await expect(rateLimit(key, 1, 1000)).resolves.toBeUndefined()
  })

  it('resetRateLimit clears a key immediately', async () => {
    const key = `r:${Math.random()}`
    await rateLimit(key, 1, 60_000)
    await resetRateLimit(key)
    await expect(rateLimit(key, 1, 60_000)).resolves.toBeUndefined()
  })

  it('evicts expired buckets once the map grows large', async () => {
    vi.useFakeTimers()
    for (let i = 0; i < 10_001; i++) await rateLimit(`bulk:${i}`, 5, 10)
    vi.advanceTimersByTime(20)
    // The sweep runs on this call; afterwards an old key starts a new window.
    await rateLimit('bulk:trigger', 5, 10)
    for (let i = 0; i < 5; i++) await expect(rateLimit('bulk:0', 5, 10)).resolves.toBeUndefined()
  })
})

describe('rateLimit (shared Redis)', () => {
  beforeEach(() => {
    r.current = fakeRedis()
  })

  it('counts in Redis, so every server instance shares the limit', async () => {
    for (let i = 0; i < 2; i++) await rateLimit('login:x', 2, 1000)
    await expect(rateLimit('login:x', 2, 1000)).rejects.toEqual(tooMany)
    expect(r.current!.store.get('rl:login:x')?.value).toBe('3')
  })

  it('sets the window expiry atomically with the first hit', async () => {
    vi.useFakeTimers()
    await rateLimit('k', 1, 1000)
    await expect(rateLimit('k', 1, 1000)).rejects.toEqual(tooMany)
    vi.advanceTimersByTime(1001)
    await expect(rateLimit('k', 1, 1000)).resolves.toBeUndefined()
  })

  it('resetRateLimit deletes the shared counter', async () => {
    await rateLimit('k2', 1, 60_000)
    await resetRateLimit('k2')
    expect(r.current!.store.has('rl:k2')).toBe(false)
    await expect(rateLimit('k2', 1, 60_000)).resolves.toBeUndefined()
  })

  it('falls back to the in-process limiter when Redis is down', async () => {
    r.current!.fail()
    const key = `down:${Math.random()}`
    await rateLimit(key, 1, 1000)
    await expect(rateLimit(key, 1, 1000)).rejects.toEqual(tooMany)
  })
})
