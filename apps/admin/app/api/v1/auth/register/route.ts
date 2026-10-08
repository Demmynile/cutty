import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/server/password'
import { issueCustomerToken } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_EXISTS_BY_EMAIL, CUSTOMER_BY_ID } from '@/lib/server/queries'
import { newId } from '@/lib/server/ledger'

export const runtime = 'nodejs'

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(10).max(20).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
})

export const POST = route(async (req) => {
  const ip = clientIp(req)
  rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  const { fullName, email, phone, password } = await parseBody(req, schema)

  // Kept for compatibility with existing records; the email is the real key.
  const uid = email.replace(/[^a-z0-9]/g, '')
  const exists = await serverClient.fetch<number>(CUSTOMER_EXISTS_BY_EMAIL, { email, uid })
  if (exists > 0) throw new HttpError(409, 'An account with this email already exists.')

  const _id = newId()
  await serverClient.create({
    _id,
    _type: 'customer',
    uid,
    fullName,
    email,
    phone,
    password: await hashPassword(password),
    sessionVersion: 0,
    walletBalance: 0,
    loyaltyPoints: 0,
    totalVisits: 0,
    tier: 'bronze',
    preferredLanguage: 'en',
    preferredCurrency: 'NGN',
    notificationPreferences: { push: true, email: true, sms: false, promos: true },
    isActive: true,
    createdAt: now(),
  })

  await audit({ action: 'customer.register', actor: { type: 'customer', id: _id, email }, ip })
  const customer = await serverClient.fetch(CUSTOMER_BY_ID, { customerId: _id })
  return NextResponse.json({ token: await issueCustomerToken(_id, 0), customer }, { status: 201 })
})
