import 'server-only'
import { NextResponse } from 'next/server'
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

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
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
