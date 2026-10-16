import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { route, clientIp } from '@/lib/server/http'
import { requireClerkUser } from '@/lib/server/clerk'
import { resolveCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { CUSTOMER_BY_ID } from '@/lib/server/queries'

export const runtime = 'nodejs'

// Profile details collected on the app's sign-up screen; only used when the
// customer record is created for the first time.
const schema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(10).max(20),
  })
  .partial()

// Called by the app right after a Clerk sign-in or sign-up (email or Google).
// Creates the customer on first sign-in, or links a pre-Clerk account with the
// same verified email, and returns the customer profile.
export const POST = route(async (req) => {
  const ip = clientIp(req)
  await rateLimit(`session:ip:${ip}`, 60, 15 * 60 * 1000)
  const clerkUserId = await requireClerkUser(req)
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  const profile = parsed.success ? parsed.data : {}

  const { customerId, outcome } = await resolveCustomer(clerkUserId, profile)
  const customer = await serverClient.fetch<{ email?: string } | null>(CUSTOMER_BY_ID, { customerId })
  if (outcome !== 'existing') {
    await audit({
      action: outcome === 'created' ? 'customer.register' : 'customer.link_clerk',
      actor: { type: 'customer', id: customerId, email: customer?.email },
      ip,
      details: { clerkUserId },
    })
  }
  return NextResponse.json({ customer }, { status: outcome === 'created' ? 201 : 200 })
})
