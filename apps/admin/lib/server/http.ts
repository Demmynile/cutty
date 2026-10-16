import 'server-only'
import { NextResponse, after } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const result = schema.safeParse(await req.json().catch(() => null))
  if (!result.success) throw new HttpError(400, 'Invalid request body')
  return result.data
}

/**
 * The caller's IP for rate limiting. Clients can put anything in
 * X-Forwarded-For, so a header set by our own proxy wins: TRUSTED_IP_HEADER
 * (e.g. "cf-connecting-ip" behind Cloudflare), then x-real-ip (Vercel, nginx),
 * then the first X-Forwarded-For hop as a last resort.
 */
export function ipFromHeaders(get: (name: string) => string | null): string {
  const trusted = process.env.TRUSTED_IP_HEADER
  return (
    (trusted && get(trusted.toLowerCase())?.split(',')[0]?.trim()) ||
    get('x-real-ip')?.trim() ||
    get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export function clientIp(req: Request): string {
  return ipFromHeaders((n) => req.headers.get(n))
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>

// Uniform error handling for API routes: expected errors keep their status and
// message; anything else is logged server-side and returned as a generic 500
// so internals (stack traces, Sanity errors) never leak to clients.
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname} failed:`, err)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }
  }
}

// Work the caller shouldn't wait for (e.g. clearing an unread count). Next keeps
// the function alive until it finishes, even on serverless. Outside a request
// (tests, scripts) it simply starts straight away.
export function afterResponse(task: () => Promise<unknown>) {
  const run = () => task().catch((err) => console.error('[afterResponse]', err))
  try {
    after(run)
  } catch {
    void run()
  }
}
