import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { mutateCustomer } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'
import { bonusGivenThisMonth, customerStats, marketplaceSettings } from '@/lib/server/stylistStats'

export const runtime = 'nodejs'

const schema = z.object({
  points: z.number().int().min(1).max(10_000),
  note: z.string().trim().min(2).max(120),
})

// Stylists reward their own regulars with bonus loyalty points. Points are
// worth money (they redeem for discounts), so: only customers who have
// actually visited or bought from this stylist, a per-award maximum, and a
// monthly cap per stylist set by Cutty in Settings → Cutty Pro Marketplace.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { stylistId, email, barberId } = await requireStylist(req, { approved: true })
  await rateLimit(`pro-bonus:${stylistId}`, 20, 60 * 60 * 1000)
  const customerId = (await params).id
  const { points, note } = await parseBody(req, schema)

  // Read the stylist's revision before the monthly total: the award below
  // writes to the stylist document conditionally on it, so two awards racing
  // past the cap can't both commit.
  const stylistRev = await serverClient.fetch<string>(`*[_type == "stylist" && _id == $id][0]._rev`, { id: stylistId })
  const [stats, givenThisMonth, settings] = await Promise.all([
    customerStats(stylistId, barberId),
    bonusGivenThisMonth(stylistId),
    marketplaceSettings(),
  ])
  if (!stats.some((c) => c.customerId === customerId)) {
    throw new HttpError(403, 'You can only reward customers who have visited or bought from you.')
  }
  if (points > settings.bonusMaxPerAward) throw new HttpError(400, `You can give at most ${settings.bonusMaxPerAward} points at a time.`)
  if (givenThisMonth + points > settings.bonusMonthlyCap) {
    throw new HttpError(400, `That would pass your monthly bonus limit (${Math.max(0, settings.bonusMonthlyCap - givenThisMonth)} points left this month).`)
  }

  const balance = await mutateCustomer(customerId, (c) => ({
    set: { loyaltyPoints: c.loyaltyPoints + points },
    create: [{
      _type: 'loyaltyTransaction',
      customer: ref(customerId),
      type: 'bonus',
      points,
      balanceAfter: c.loyaltyPoints + points,
      description: note,
      source: 'stylist',
      stylist: ref(stylistId),
      createdAt: now(),
    }],
    patch: [{ id: stylistId, rev: stylistRev, set: { lastBonusAt: now() } }],
    result: c.loyaltyPoints + points,
  }))
  await audit({ action: 'stylist.bonus', actor: { type: 'stylist', id: stylistId, email }, target: { type: 'customer', id: customerId }, details: { points } })
  return NextResponse.json({ ok: true, customerPoints: balance, remainingThisMonth: settings.bonusMonthlyCap - givenThisMonth - points })
})
