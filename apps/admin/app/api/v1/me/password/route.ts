import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { requireCustomer, issueCustomerToken } from '@/lib/server/customerAuth'
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from '@/lib/server/password'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_CREDENTIALS_BY_ID } from '@/lib/server/queries'

export const runtime = 'nodejs'

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

// Changing the password bumps sessionVersion, which signs out every other
// device. The caller gets a fresh token so this device stays signed in.
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  const ip = clientIp(req)
  rateLimit(`password:${customerId}`, 5, 15 * 60 * 1000)
  const { currentPassword, newPassword } = await parseBody(req, schema)

  const creds = await serverClient.fetch<{ _rev: string; password?: string; sessionVersion?: number } | null>(CUSTOMER_CREDENTIALS_BY_ID, { customerId })
  if (!creds?.password || !(await verifyPassword(currentPassword, creds.password))) {
    await audit({ action: 'customer.password_change', actor: { type: 'customer', id: customerId, email }, outcome: 'failure', ip })
    throw new HttpError(403, 'Current password is incorrect')
  }

  const sessionVersion = (creds.sessionVersion ?? 0) + 1
  await serverClient.patch(customerId).ifRevisionId(creds._rev).set({ password: await hashPassword(newPassword), sessionVersion }).commit()
  await audit({ action: 'customer.password_change', actor: { type: 'customer', id: customerId, email }, ip })
  return NextResponse.json({ token: await issueCustomerToken(customerId, sessionVersion) })
})
