import 'server-only'
import { redis } from './redis'

// Read-through cache for public, non-personal data (the shop catalogue and the
// stylist directory). Keys live under a generation number: invalidateCatalog()
// bumps it, so every cached entry is dropped at once without scanning keys.
// Edits made in Sanity Studio don't go through this API, so entries also expire
// on their own after `ttlSeconds`.
const GEN = 'cache:catalog:gen'

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const r = redis()
  if (!r) return load()

  let fullKey: string | null = null
  try {
    fullKey = `cache:catalog:${(await r.get(GEN)) ?? '0'}:${key}`
    const hit = await r.get(fullKey)
    if (hit !== null) return JSON.parse(hit) as T
  } catch {
    // Redis unavailable: serve straight from Sanity.
  }

  const value = await load()
  if (fullKey) r.set(fullKey, JSON.stringify(value ?? null), 'EX', ttlSeconds).catch(() => {})
  return value
}

export async function invalidateCatalog() {
  await redis()?.incr(GEN).catch(() => {})
}
