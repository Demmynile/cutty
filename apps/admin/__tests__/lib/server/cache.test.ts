import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeRedis } from '../../helpers/redis'

const r = { current: null as ReturnType<typeof fakeRedis> | null }
vi.mock('@/lib/server/redis', () => ({ redis: () => r.current?.client ?? null }))

const { cached, invalidateCatalog } = await import('@/lib/server/cache')

afterEach(() => {
  vi.useRealTimers()
  r.current = null
})

describe('cached without Redis', () => {
  it('always loads fresh', async () => {
    const load = vi.fn().mockResolvedValue([1])
    await cached('k', 60, load)
    await cached('k', 60, load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('cached with Redis', () => {
  beforeEach(() => {
    r.current = fakeRedis()
  })

  it('serves repeat reads from Redis', async () => {
    const load = vi.fn().mockResolvedValue([{ _id: 's1' }])
    await expect(cached('services', 60, load)).resolves.toEqual([{ _id: 's1' }])
    // the write is fire-and-forget
    await vi.waitFor(() => expect(r.current!.client.set).toHaveBeenCalled())
    await expect(cached('services', 60, load)).resolves.toEqual([{ _id: 's1' }])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('caches a null result too, so missing products are cheap', async () => {
    const load = vi.fn().mockResolvedValue(null)
    await cached('product:nope', 60, load)
    await vi.waitFor(() => expect(r.current!.client.set).toHaveBeenCalled())
    await expect(cached('product:nope', 60, load)).resolves.toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('expires entries after the TTL, so Studio edits show up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const load = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    await cached('k', 60, load)
    await vi.waitFor(() => expect(r.current!.client.set).toHaveBeenCalled())
    vi.setSystemTime(Date.now() + 61_000)
    await expect(cached('k', 60, load)).resolves.toBe('new')
  })

  it('invalidateCatalog drops every cached entry at once', async () => {
    const load = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    await cached('products', 60, load)
    await vi.waitFor(() => expect(r.current!.client.set).toHaveBeenCalled())
    await invalidateCatalog()
    await expect(cached('products', 60, load)).resolves.toBe('new')
  })

  it('falls back to Sanity when Redis is down', async () => {
    r.current!.fail()
    const load = vi.fn().mockResolvedValue('fresh')
    await expect(cached('k', 60, load)).resolves.toBe('fresh')
    await expect(invalidateCatalog()).resolves.toBeUndefined()
  })
})
