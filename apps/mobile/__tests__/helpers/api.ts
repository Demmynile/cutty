import { vi } from 'vitest'

type Answer = unknown | ((body: unknown, path: string) => unknown)

/**
 * Routes a mocked `api()` by "METHOD /path" (exact path incl. query, or a
 * prefix ending in "*"). Unrouted calls reject with a 404 ApiError so a
 * missing route is loud. Answers that are Errors are thrown.
 */
export function routeApi(api: unknown, routes: Record<string, Answer>) {
  vi.mocked(api as (m: string, p: string, b?: unknown) => Promise<unknown>).mockImplementation(async (method: string, path: string, body?: unknown) => {
    const key = `${method} ${path}`
    const hit = Object.keys(routes).find((k) => k === key || (k.endsWith('*') && key.startsWith(k.slice(0, -1))))
    if (!hit) {
      const { ApiError } = await import('@/lib/api')
      throw new ApiError(404, `unrouted ${key}`)
    }
    const answer = routes[hit]
    const value = typeof answer === 'function' ? (answer as (b: unknown, p: string) => unknown)(body, path) : answer
    if (value instanceof Error) throw value
    return value
  })
}

/** The bodies sent to one "METHOD /path". */
export function sent(api: unknown, key: string) {
  const [method, path] = key.split(' ')
  return vi.mocked(api as (m: string, p: string, b?: unknown) => Promise<unknown>).mock.calls.filter(([m, p]) => m === method && p === path).map((c) => c[2])
}
