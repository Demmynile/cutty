import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus } from '@cutty/types'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { markOrderPaid } from '@/lib/server/orders'
import { audit } from '@/lib/server/audit'
import { PRO_SALE_BY_ID } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

// What a seller may do with each order status. Card orders become `paid` only
// through Paystack (lib/server/paystack.ts); a seller confirms payment by
// hand only for bank transfers paid straight to them.
const ACTIONS = {
  confirm_payment: { from: ['pending'], to: 'paid' },
  accept: { from: ['paid'], to: 'processing' },
  ship: { from: ['processing'], to: 'shipped' },
  deliver: { from: ['shipped'], to: 'delivered' },
  cancel: { from: ['pending'], to: 'cancelled' },
} as const satisfies Record<string, { from: readonly OrderStatus[]; to: OrderStatus }>

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { stylistId, email } = await requireStylist(req, { shop: true })
  const { action } = await parseBody(req, z.object({ action: z.enum(['confirm_payment', 'accept', 'ship', 'deliver', 'cancel']) }))
  const order = await serverClient.fetch<{
    _id: string; _rev: string; status: OrderStatus; orderNumber: string; paymentMethod?: string; pointsEarned: number; customerId: string
  } | null>(PRO_SALE_BY_ID, { id: (await params).id, stylistId })
  if (!order) throw new HttpError(404, 'Order not found')

  const rule = ACTIONS[action]
  if (!(rule.from as readonly string[]).includes(order.status)) {
    throw new HttpError(400, `This order is ${order.status}; it can't be updated that way.`)
  }
  if (action === 'confirm_payment' && order.paymentMethod !== 'transfer') {
    throw new HttpError(400, 'Card payments are confirmed automatically by Paystack.')
  }
  // A pending card order may still be mid-payment on Paystack; cancelling it
  // could leave the customer charged for a cancelled order.
  if (action === 'cancel' && order.paymentMethod !== 'transfer') {
    throw new HttpError(400, 'Card orders that are still pending close by themselves if the customer does not pay.')
  }

  if (rule.to === 'paid') {
    // Cutty can't verify a transfer made straight to the stylist, so it earns
    // no Cutty loyalty points (otherwise a stylist could mint points for friends).
    await markOrderPaid({ ...order, pointsEarned: 0 }, { sellerConfirmedAt: now(), markedPaidBy: email, pointsEarned: 0 })
  } else {
    await serverClient
      .patch(order._id)
      .ifRevisionId(order._rev)
      .set({ status: rule.to, ...(action === 'accept' ? { sellerConfirmedAt: now() } : {}) })
      .commit()
  }

  await audit({
    action: 'stylist.sale_status',
    actor: { type: 'stylist', id: stylistId, email },
    target: { type: 'order', id: order._id },
    details: { from: order.status, to: rule.to },
  })
  return NextResponse.json({ ok: true, status: rule.to })
})
