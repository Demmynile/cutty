import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { newId } from '@/lib/server/ledger'
import { initializePayment, callbackUrl } from '@/lib/server/paystack'
import { audit } from '@/lib/server/audit'

export const runtime = 'nodejs'

const schema = z.object({
  // kobo: ₦100 – ₦1,000,000
  amount: z.number().int().min(10_000).max(100_000_000),
})

// Creates a *pending* wallet credit and hands back a Paystack checkout URL.
// The balance only changes once Paystack confirms the charge (settlePayment).
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  rateLimit(`topup:${customerId}`, 10, 60 * 60 * 1000)
  const { amount } = await parseBody(req, schema)

  const _id = newId()
  const reference = `cutty_top_${_id.replace(/-/g, '')}`
  await serverClient.create({
    _id,
    _type: 'walletTransaction',
    customer: ref(customerId),
    type: 'credit',
    category: 'topup',
    amount,
    description: 'Wallet top-up',
    paymentReference: reference,
    status: 'pending',
    createdAt: now(),
  })

  const authorizationUrl = await initializePayment({ email, amount, reference, kind: 'topup', callbackUrl: callbackUrl(req) })
  await audit({ action: 'wallet.topup_started', actor: { type: 'customer', id: customerId, email }, target: { type: 'walletTransaction', id: _id }, details: { amount, reference } })
  return NextResponse.json({ authorizationUrl, reference }, { status: 201 })
})
