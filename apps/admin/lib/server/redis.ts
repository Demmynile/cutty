import 'server-only'
import Redis from 'ioredis'

// Optional shared Redis (REDIS_URL, e.g. redis://localhost:6379 or an Upstash
// rediss:// URL). Without it every caller falls back to its in-process
// behaviour, so local dev and tests need nothing extra. Commands time out fast
// and callers treat a failure as a cache miss: Redis being down slows the API
// down, it never takes it down.
const g = globalThis as { __cuttyRedis?: Redis | null }

export function redis(): Redis | null {
  if (g.__cuttyRedis !== undefined) return g.__cuttyRedis
  const url = process.env.REDIS_URL
  if (!url) return (g.__cuttyRedis = null)
  const client = new Redis(url, {
    connectTimeout: 2_000,
    commandTimeout: 500,
    maxRetriesPerRequest: 1,
    keyPrefix: 'cutty:',
  })
  client.on('error', (err) => console.error('[redis]', err.message))
  return (g.__cuttyRedis = client)
}
