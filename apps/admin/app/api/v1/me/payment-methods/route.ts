import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'

export const runtime = 'nodejs'

// Display-only card metadata. Only brand + last 4 digits are accepted — a full
// card number (PAN) or CVV must never be sent to or stored by this system.
const card = z
  .object({
    _key: z.string().min(1).max(64),
    brand: z.enum(['visa', 'mastercard', 'verve', 'other']),
    last4: z.string().regex(/^\d{4}$/),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int().min(2000).max(2100),
    holderName: z.string().trim().min(1).max(100),
    isDefault: z.boolean(),
  })
  .strict()

export const PUT = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  const { paymentMethods } = await parseBody(req, z.object({ paymentMethods: z.array(card).max(10) }))
  await serverClient.patch(customerId).set({ paymentMethods }).commit()
  return NextResponse.json({ paymentMethods })
})
