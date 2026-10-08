import 'server-only'
import { HttpError } from './http'

// Fixed-window limiter held in process memory. Good enough for a single
// long-running server; on serverless (Vercel) each instance has its own
// counters, so swap the store for Redis/Upstash before relying on it there.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
  } else if (++bucket.count > limit) {
    throw new HttpError(429, 'Too many requests. Please wait a moment and try again.')
  }

  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}
