import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { requireClerkUser, clerkIdentity } from '@/lib/server/clerk'
import { findStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { accountId } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'
import { loadAccount } from '@/lib/server/stylists'
import { locationSchema, locationValue } from '@/lib/server/proSchemas'

export const runtime = 'nodejs'

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(20),
  kind: z.enum(['barber', 'braider', 'both']),
  // Asked for during sign-up so approved stylists land on the customer map.
  // Optional so older app versions can still register.
  location: locationSchema.optional(),
})

// Creates the Cutty Pro profile for a signed-in Clerk user. Stylist accounts
// are separate from customer accounts (the same Clerk user may hold both).
// New accounts start `pending`: they can build their profile and
// availability, but aren't listed or bookable until an admin approves them.
export const POST = route(async (req) => {
  const ip = clientIp(req)
  await rateLimit(`pro-register:${ip}`, 5, 60 * 60 * 1000)
  const clerkUserId = await requireClerkUser(req)
  const body = await parseBody(req, schema)

  if (await findStylist(clerkUserId)) {
    throw new HttpError(409, 'You already have a Cutty Pro account. Sign in instead.')
  }
  const { email } = await clerkIdentity(clerkUserId)
  if (!email) throw new HttpError(403, 'Verify your email address to continue.')

  // Fixed id per Clerk user, so a double-submitted sign-up can't create two profiles.
  const _id = accountId('stylist', clerkUserId)
  try {
    await serverClient.create({
      _id,
      _type: 'stylist',
      clerkUserId,
      fullName: body.fullName,
      email,
      phone: body.phone,
      kind: body.kind,
      skills: [],
      styles: [],
      weeklyAvailability: [],
      timeOff: [],
      ...(body.location ? { location: locationValue(body.location) } : {}),
      status: 'pending',
      shop: { status: 'none' },
      isActive: true,
      createdAt: now(),
    })
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 409) throw new HttpError(409, 'You already have a Cutty Pro account. Sign in instead.')
    throw err
  }
  await audit({ action: 'stylist.register', actor: { type: 'stylist', id: _id, email }, ip, details: { clerkUserId } })
  return NextResponse.json({ stylist: await loadAccount(_id) }, { status: 201 })
})
