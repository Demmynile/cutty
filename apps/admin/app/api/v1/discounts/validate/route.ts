import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadDiscount } from '@/lib/server/discounts'

export const runtime = 'nodejs'

const schema = z.object({
  code: z.string().trim().min(1).max(64),
  context: z.enum(['order', 'booking']),
  subtotal: z.number().int().min(0),
})

// Preview only — the order/booking routes re-validate and recompute the
// discount when the purchase is actually made.
export const POST = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  await rateLimit(`discount:${customerId}`, 20, 10 * 60 * 1000)
  const { code, context, subtotal } = await parseBody(req, schema)
  const { doc } = await loadDiscount(code, context, subtotal, customerId)
  return NextResponse.json({
    _id: doc._id,
    code: doc.code,
    type: doc.type,
    value: doc.value,
    maxDiscountAmount: doc.maxDiscountAmount,
    minOrderAmount: doc.minOrderAmount,
    applicableTo: doc.applicableTo,
  })
})
