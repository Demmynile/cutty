import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { LOYALTY_REWARDS } from '@cutty/types'
import { ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { mutateCustomer } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'

export const runtime = 'nodejs'

export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  await rateLimit(`redeem:${customerId}`, 10, 60 * 60 * 1000)
  const { rewardId } = await parseBody(req, z.object({ rewardId: z.string() }))
  const reward = LOYALTY_REWARDS.find((r) => r.id === rewardId)
  if (!reward) throw new HttpError(400, 'Unknown reward')

  // Unguessable, single-use, bound to this customer.
  const code = `CUTTY-${randomBytes(5).toString('hex').toUpperCase()}`

  const loyaltyPoints = await mutateCustomer(customerId, (c) => {
    if (c.loyaltyPoints < reward.points) throw new HttpError(400, `You need ${reward.points} points for this reward.`)
    const after = c.loyaltyPoints - reward.points
    return {
      set: { loyaltyPoints: after },
      create: [
        {
          _type: 'discountCode', code, type: reward.type, value: reward.value, applicableTo: 'both',
          pointsCost: reward.points, customer: ref(customerId), maxUses: 1, usedCount: 0, isActive: true,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now(),
        },
        {
          _type: 'loyaltyTransaction', customer: ref(customerId), type: 'redeem', points: -reward.points,
          balanceAfter: after, description: `Redeemed for: ${reward.label}`, source: 'redemption', createdAt: now(),
        },
      ],
      result: after,
    }
  })

  await audit({ action: 'loyalty.redeem', actor: { type: 'customer', id: customerId, email }, details: { rewardId, points: reward.points } })
  return NextResponse.json({ code, loyaltyPoints })
})
