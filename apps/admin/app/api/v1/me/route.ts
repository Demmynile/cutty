import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, clientIp } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { deleteClerkUser } from '@/lib/server/clerk'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_BY_ID } from '@/lib/server/queries'
import { STYLIST_SESSION_BY_CLERK_ID } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(CUSTOMER_BY_ID, { customerId }))
})

// Allow-list of self-editable fields. Balances, tier, points and visits are
// never writable by the customer.
const patchSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(10).max(20).nullable(),
    preferredLanguage: z.enum(['en', 'yo', 'ig', 'ha', 'fr']),
    preferredCurrency: z.enum(['NGN', 'USD', 'GBP']),
    notificationPreferences: z.object({
      push: z.boolean(), email: z.boolean(), sms: z.boolean(), promos: z.boolean(),
    }),
  })
  .partial()
  .strict()

export const PATCH = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  const { phone, ...rest } = await parseBody(req, patchSchema)
  const patch = serverClient.patch(customerId).set(rest)
  if (phone === null) patch.unset(['phone'])
  else if (phone !== undefined) patch.set({ phone })
  await patch.commit()
  return NextResponse.json(await serverClient.fetch(CUSTOMER_BY_ID, { customerId }))
})

// Customers are strongly referenced by bookings, orders and transactions, so
// the document can't be hard-deleted without losing shop records. Instead we
// scrub everything personal, deactivate it and unlink the Clerk sign-in. The
// Clerk user itself is deleted too, unless it still owns a Cutty Pro account.
export const DELETE = route(async (req) => {
  const { customerId, email, clerkUserId } = await requireCustomer(req)
  const ip = clientIp(req)
  await rateLimit(`delete:${customerId}`, 5, 15 * 60 * 1000)
  await parseBody(req, z.object({ confirm: z.literal('DELETE') }))

  await serverClient
    .patch(customerId)
    .set({
      uid: `deleted-${customerId}`,
      fullName: 'Deleted user',
      email: `deleted-${customerId}@deleted.cutty.app`,
      isActive: false,
      deletedAt: now(),
    })
    .unset(['clerkUserId', 'phone', 'avatar', 'password', 'paymentMethods', 'notificationPreferences'])
    .commit()

  const stylist = await serverClient.fetch<{ _id: string } | null>(STYLIST_SESSION_BY_CLERK_ID, { clerkUserId })
  if (!stylist) await deleteClerkUser(clerkUserId)

  await audit({ action: 'customer.delete', actor: { type: 'customer', id: customerId, email }, target: { type: 'customer', id: customerId }, ip })
  return NextResponse.json({ ok: true })
})
