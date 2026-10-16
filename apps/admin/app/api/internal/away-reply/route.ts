import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { replyAsAway } from '@/lib/server/awayAssistant'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(req: Request) {
  const secret = process.env.REALTIME_INTERNAL_SECRET
  const given = req.headers.get('x-internal-secret')
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Called only by the realtime server when a customer messages a stylist who
// has no device connected. Shares REALTIME_INTERNAL_SECRET with it.
export const POST = route(async (req) => {
  if (!authorized(req)) throw new HttpError(401, 'Unauthorized')
  const { conversationId } = await parseBody(req, z.object({ conversationId: z.string().min(1).max(120) }))
  try {
    return NextResponse.json({ result: await replyAsAway(conversationId) })
  } catch (err) {
    console.error('[ai/away]', err)
    throw new HttpError(502, 'Away assistant failed')
  }
})
