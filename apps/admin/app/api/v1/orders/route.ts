import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadDiscount, consumeDiscount } from '@/lib/server/discounts'
import { mutateCustomer, newId, orderNumber } from '@/lib/server/ledger'
import { initializePayment, callbackUrl } from '@/lib/server/paystack'
import { audit } from '@/lib/server/audit'
import { ORDERS_BY_CUSTOMER, PRODUCTS_BY_IDS } from '@/lib/server/queries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(ORDERS_BY_CUSTOMER, { customerId }))
})

const schema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(20),
  }),
  paymentMethod: z.enum(['wallet', 'card', 'transfer']),
  discountCode: z.string().trim().max(64).optional(),
})

type ProductRow = { _id: string; name: string; price: number; stock?: number; pointsEarned?: number }

// Totals are always computed here from current product prices. Wallet orders
// are debited atomically; card/transfer orders stay `pending` until Paystack
// confirms payment (lib/server/paystack.ts → settlePayment).
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  rateLimit(`order:${customerId}`, 10, 60 * 60 * 1000)
  const body = await parseBody(req, schema)

  const quantities = new Map<string, number>()
  for (const i of body.items) quantities.set(i.productId, (quantities.get(i.productId) ?? 0) + i.quantity)
  const products = await serverClient.fetch<ProductRow[]>(PRODUCTS_BY_IDS, { ids: [...quantities.keys()] })
  if (products.length !== quantities.size) throw new HttpError(400, 'Some items are no longer available.')
  for (const p of products) {
    if (typeof p.stock === 'number' && p.stock < quantities.get(p._id)!) throw new HttpError(400, `Only ${p.stock} of ${p.name} left in stock.`)
  }

  const subtotal = products.reduce((sum, p) => sum + p.price * quantities.get(p._id)!, 0)
  const pointsEarned = products.reduce((sum, p) => sum + (p.pointsEarned ?? 0) * quantities.get(p._id)!, 0)
  const discount = body.discountCode ? await loadDiscount(body.discountCode, 'order', subtotal, customerId) : null
  const totalAmount = subtotal - (discount?.amount ?? 0)

  const _id = newId()
  const number = orderNumber()
  const payNow = body.paymentMethod === 'wallet' || totalAmount === 0
  const reference = payNow ? undefined : `cutty_ord_${_id.replace(/-/g, '')}`

  const order = {
    _id,
    _type: 'order',
    orderNumber: number,
    customer: ref(customerId),
    items: products.map((p) => ({
      _key: p._id,
      product: ref(p._id),
      quantity: quantities.get(p._id)!,
      priceAtOrder: p.price,
      productName: p.name,
    })),
    subtotal,
    discountAmount: discount?.amount ?? 0,
    shippingFee: 0,
    totalAmount,
    pointsEarned,
    paymentMethod: body.paymentMethod,
    status: payNow ? 'paid' : 'pending',
    paymentReference: reference,
    shippingAddress: body.shippingAddress,
    ...(discount ? { discountCode: ref(discount.doc._id) } : {}),
    createdAt: now(),
  }

  if (payNow) {
    await mutateCustomer(customerId, (c) => {
      if (c.walletBalance < totalAmount) throw new HttpError(402, 'Insufficient wallet balance. Please top up.')
      const walletAfter = c.walletBalance - totalAmount
      const pointsAfter = c.loyaltyPoints + pointsEarned
      return {
        set: { walletBalance: walletAfter, loyaltyPoints: pointsAfter },
        create: [
          order,
          ...(totalAmount > 0 ? [{
            _type: 'walletTransaction', customer: ref(customerId), type: 'debit', category: 'order_payment',
            amount: totalAmount, balanceAfter: walletAfter, description: `Order #${number}`,
            referenceId: _id, status: 'completed', createdAt: now(),
          }] : []),
          ...(pointsEarned > 0 ? [{
            _type: 'loyaltyTransaction', customer: ref(customerId), type: 'earn', points: pointsEarned,
            balanceAfter: pointsAfter, description: `Points from Order #${number}`, source: 'order',
            referenceId: _id, createdAt: now(),
          }] : []),
        ],
        patch: discount ? [consumeDiscount(discount.doc)] : [],
        result: null,
      }
    })
    await audit({ action: 'order.create', actor: { type: 'customer', id: customerId, email }, target: { type: 'order', id: _id }, details: { totalAmount, paymentMethod: 'wallet' } })
    return NextResponse.json({ _id, orderNumber: number, status: 'paid' }, { status: 201 })
  }

  const tx = serverClient.transaction().create(order)
  if (discount) {
    const c = consumeDiscount(discount.doc)
    tx.patch(c.id, (p) => p.ifRevisionId(c.rev).set(c.set))
  }
  await tx.commit()

  const authorizationUrl = await initializePayment({ email, amount: totalAmount, reference: reference!, kind: 'order', callbackUrl: callbackUrl(req) })
  await audit({ action: 'order.create', actor: { type: 'customer', id: customerId, email }, target: { type: 'order', id: _id }, details: { totalAmount, paymentMethod: body.paymentMethod, reference } })
  return NextResponse.json({ _id, orderNumber: number, status: 'pending', authorizationUrl, reference }, { status: 201 })
})
