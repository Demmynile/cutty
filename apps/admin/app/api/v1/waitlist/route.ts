import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody, clientIp } from '@/lib/server/http'
import { rateLimit } from '@/lib/server/rateLimit'
import { serverClient, now } from '@/lib/server/sanity'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(80).optional(),
  role: z.enum(['customer', 'stylist']).default('customer'),
  city: z.string().trim().max(80).optional(),
})

// The marketing site (apps/web) lives on its own origin, so this is the one
// public route that answers cross-origin requests. WAITLIST_ALLOWED_ORIGINS is
// a comma-separated allowlist; in development the local site is allowed too.
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  const list = (process.env.WAITLIST_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (process.env.NODE_ENV === 'development') list.push('http://localhost:3004')
  return list.includes(origin) ? origin : null
}

function withCors(req: Request, res: Response): Response {
  const origin = allowedOrigin(req)
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    res.headers.set('Access-Control-Max-Age', '86400')
  }
  res.headers.set('Vary', 'Origin')
  return res
}

export function OPTIONS(req: Request) {
  return withCors(req, new Response(null, { status: 204 }))
}

const handler = route(async (req) => {
  await rateLimit(`waitlist:${clientIp(req)}`, 5, 10 * 60 * 1000)
  const { email, name, role, city } = await parseBody(req, schema)

  // One document per email: signing up twice is a no-op, and the response is
  // identical either way so the form can't be used to probe who has joined.
  const id = `waitlist.${createHash('sha256').update(email).digest('hex').slice(0, 32)}`
  await serverClient.createIfNotExists({ _id: id, _type: 'waitlistEntry', email, name, role, city, createdAt: now() })

  const count = await serverClient.fetch<number>('count(*[_type == "waitlistEntry"])')
  return NextResponse.json({ ok: true, count })
})

export async function POST(req: Request, ctx: unknown) {
  return withCors(req, await handler(req, ctx))
}
