import 'server-only'
import { HttpError } from './http'
import { redis } from './redis'

// Fixed-window limiter. With REDIS_URL set the counters are shared by every
// server instance (needed on serverless, where each instance has its own
// memory); otherwise, or if Redis is unreachable, they live in this process.
const buckets = new Map<string, { count: number; resetAt: number }>()

const TOO_MANY = 'Too many requests. Please wait a moment and try again.'

// INCR and set the expiry in one atomic step, so a crash between the two can
// never leave a counter that never resets.
const INCR_WINDOW = `local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return c`

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const r = redis()
  if (r) {
    let count: number | null = null
    try {
      count = Number(await r.eval(INCR_WINDOW, 1, `rl:${key}`, windowMs))
    } catch {
      // fall through to the in-process limiter
    }
    if (count !== null) {
      if (count > limit) throw new HttpError(429, TOO_MANY)
      return
    }
  }
  memoryLimit(key, limit, windowMs)
}

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
  } else if (++bucket.count > limit) {
    throw new HttpError(429, TOO_MANY)
  }

  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
}

export async function resetRateLimit(key: string) {
  buckets.delete(key)
  await redis()?.del(`rl:${key}`).catch(() => {})
}
