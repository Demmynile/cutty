import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { verifyPassword } from '@/lib/server/password'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_BY_ID, CUSTOMER_CREDENTIALS_BY_ID } from '@/lib/server/queries'

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
// scrub everything personal, deactivate it and revoke all sessions.
export const DELETE = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  const ip = clientIp(req)
  rateLimit(`delete:${customerId}`, 5, 15 * 60 * 1000)
  const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(200) }))

  const creds = await serverClient.fetch<{ password?: string; sessionVersion?: number } | null>(CUSTOMER_CREDENTIALS_BY_ID, { customerId })
  if (!creds?.password || !(await verifyPassword(password, creds.password))) {
    throw new HttpError(403, 'Enter your current password to delete your account.')
  }

  await serverClient
    .patch(customerId)
    .set({
      uid: `deleted-${customerId}`,
      fullName: 'Deleted user',
      email: `deleted-${customerId}@deleted.cutty.app`,
      isActive: false,
      deletedAt: now(),
      sessionVersion: (creds.sessionVersion ?? 0) + 1,
    })
    .unset(['phone', 'avatar', 'password', 'paymentMethods', 'notificationPreferences'])
    .commit()

  await audit({ action: 'customer.delete', actor: { type: 'customer', id: customerId, email }, target: { type: 'customer', id: customerId }, ip })
  return NextResponse.json({ ok: true })
})
