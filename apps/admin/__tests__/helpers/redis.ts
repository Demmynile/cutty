import { vi } from 'vitest'

// In-memory stand-in for the few ioredis commands the server uses. Expiry is
// tracked against Date.now(), so fake timers work. `fail()` makes every call
// reject, like Redis being unreachable.
export function fakeRedis() {
  const store = new Map<string, { value: string; expiresAt: number | null }>()
  let down = false
  const live = (k: string) => {
    const e = store.get(k)
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) store.delete(k)
    return store.get(k)
  }
  const guard = <A extends unknown[], R>(fn: (...a: A) => R) =>
    vi.fn(async (...a: A) => {
      if (down) throw new Error('Connection is closed.')
      return fn(...a)
    })
  const incr = (k: string) => {
    const e = live(k)
    const n = Number(e?.value ?? 0) + 1
    store.set(k, { value: String(n), expiresAt: e?.expiresAt ?? null })
    return n
  }

  const client = {
    get: guard((k: string) => live(k)?.value ?? null),
    set: guard((k: string, v: string, _ex: 'EX', seconds: number) => {
      store.set(k, { value: v, expiresAt: Date.now() + seconds * 1000 })
      return 'OK'
    }),
    incr: guard(incr),
    del: guard((k: string) => Number(store.delete(k))),
    // Only the rate limiter's INCR + PEXPIRE script is supported.
    eval: guard((_script: string, _n: number, k: string, windowMs: number) => {
      const n = incr(k)
      if (n === 1) store.get(k)!.expiresAt = Date.now() + Number(windowMs)
      return n
    }),
  }
  return { client, store, fail: () => { down = true }, recover: () => { down = false } }
}
