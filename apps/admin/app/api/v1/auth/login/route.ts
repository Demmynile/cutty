import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { hashPassword, needsRehash, verifyDummy, verifyPassword } from '@/lib/server/password'
import { issueCustomerToken } from '@/lib/server/customerAuth'
import { rateLimit, resetRateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_CREDENTIALS_BY_EMAIL, CUSTOMER_BY_ID } from '@/lib/server/queries'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

const INVALID = 'Incorrect email or password.'

export const POST = route(async (req) => {
  const ip = clientIp(req)
  const { email, password } = await parseBody(req, schema)

  // Brute-force protection: per account and per source IP.
  rateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000)
  rateLimit(`login:acct:${email}`, 5, 15 * 60 * 1000)

  const creds = await serverClient.fetch<{ _id: string; password?: string; sessionVersion?: number } | null>(
    CUSTOMER_CREDENTIALS_BY_EMAIL,
    { email },
  )

  // Accounts with no stored hash (created before passwords existed) must use
  // a password reset instead of being let straight in.
  if (!creds || !creds.password) {
    await verifyDummy(password)
    await audit({ action: 'customer.login', actor: { type: 'customer', id: creds?._id ?? 'unknown', email }, outcome: 'failure', ip, details: { reason: creds ? 'no_password_set' : 'no_account' } })
    throw new HttpError(401, INVALID)
  }

  if (!(await verifyPassword(password, creds.password))) {
    await audit({ action: 'customer.login', actor: { type: 'customer', id: creds._id, email }, outcome: 'failure', ip, details: { reason: 'bad_password' } })
    throw new HttpError(401, INVALID)
  }

  resetRateLimit(`login:acct:${email}`)
  if (needsRehash(creds.password)) {
    await serverClient.patch(creds._id).set({ password: await hashPassword(password) }).commit()
  }

  await audit({ action: 'customer.login', actor: { type: 'customer', id: creds._id, email }, ip })
  const customer = await serverClient.fetch(CUSTOMER_BY_ID, { customerId: creds._id })
  return NextResponse.json({ token: await issueCustomerToken(creds._id, creds.sessionVersion ?? 0), customer })
})
