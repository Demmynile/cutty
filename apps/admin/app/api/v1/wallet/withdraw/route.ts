import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ref, now } from '@/lib/server/sanity'
import { route, parseBody, clientIp, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { mutateCustomer } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'

export const runtime = 'nodejs'

const schema = z.object({ amount: z.number().int().min(10_000).max(100_000_000) })

// Withdrawals are requests, not instant payouts: the amount is held (debited)
// and recorded as `pending` for staff to pay out and mark completed. Automating
// this needs Paystack Transfers plus verified bank details for each customer.
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  await rateLimit(`withdraw:${customerId}`, 3, 24 * 60 * 60 * 1000)
  const { amount } = await parseBody(req, schema)

  const balanceAfter = await mutateCustomer(customerId, (c) => {
    if (c.walletBalance < amount) throw new HttpError(402, 'Insufficient wallet balance.')
    const after = c.walletBalance - amount
    return {
      set: { walletBalance: after },
      create: [{
        _type: 'walletTransaction', customer: ref(customerId), type: 'debit', category: 'withdrawal',
        amount, balanceAfter: after, description: 'Withdrawal request', status: 'pending', createdAt: now(),
      }],
      result: after,
    }
  })

  await audit({ action: 'wallet.withdraw_requested', actor: { type: 'customer', id: customerId, email }, ip: clientIp(req), details: { amount } })
  return NextResponse.json({ walletBalance: balanceAfter, status: 'pending' }, { status: 201 })
})
