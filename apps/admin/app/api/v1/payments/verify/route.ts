import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { settlePayment } from '@/lib/server/paystack'

export const runtime = 'nodejs'

// Called by the app when the Paystack checkout closes. Safe to call repeatedly.
export const POST = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  rateLimit(`verify:${customerId}`, 30, 10 * 60 * 1000)
  const { reference } = await parseBody(req, z.object({ reference: z.string().regex(/^cutty_(top|ord)_[a-f0-9]{32}$/) }))
  return NextResponse.json(await settlePayment(reference, customerId))
})
