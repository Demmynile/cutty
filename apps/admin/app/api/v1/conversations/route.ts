import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { CONVERSATIONS_FOR_CUSTOMER, CONVERSATION_BY_PAIR } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(CONVERSATIONS_FOR_CUSTOMER, { customerId }))
})

// Opens (or returns the existing) thread with an approved stylist.
export const POST = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  await rateLimit(`convo:${customerId}`, 20, 60 * 60 * 1000)
  const { stylistId } = await parseBody(req, z.object({ stylistId: z.string().min(1).max(80) }))

  const existing = await serverClient.fetch(CONVERSATION_BY_PAIR, { customerId, stylistId })
  if (existing) return NextResponse.json(existing)

  const ok = await serverClient.fetch<number>(`count(*[_type == "stylist" && _id == $id && status == "approved" && isActive != false])`, { id: stylistId })
  if (!ok) throw new HttpError(404, 'Stylist not found')

  // Deterministic id: two taps at once can't create two threads.
  const _id = `conversation-${customerId}-${stylistId}`.replace(/[^a-zA-Z0-9_-]/g, '')
  await serverClient.createIfNotExists({
    _id,
    _type: 'conversation',
    customer: ref(customerId),
    stylist: ref(stylistId),
    customerUnread: 0,
    stylistUnread: 0,
    createdAt: now(),
  })
  return NextResponse.json(await serverClient.fetch(CONVERSATION_BY_PAIR, { customerId, stylistId }), { status: 201 })
})

