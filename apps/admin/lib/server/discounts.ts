import 'server-only'
import { serverClient } from './sanity'
import { HttpError } from './http'
import { DISCOUNT_CODE_BY_CODE } from './queries'

export type DiscountDoc = {
  _id: string
  _rev: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  maxDiscountAmount?: number
  minOrderAmount?: number
  applicableTo: 'booking' | 'order' | 'both'
  maxUses?: number
  usedCount?: number
  validFrom?: string
  validUntil?: string
  customerId?: string
}

// Server-side source of truth for discount codes. The client may preview a
// discount, but the amount actually charged is always recomputed here.
export async function loadDiscount(
  rawCode: string,
  context: 'order' | 'booking',
  subtotal: number,
  customerId: string,
): Promise<{ doc: DiscountDoc; amount: number }> {
  const code = rawCode.trim().toUpperCase()
  const doc = await serverClient.fetch<DiscountDoc | null>(DISCOUNT_CODE_BY_CODE, { code })
  const now = new Date()

  if (!doc) throw new HttpError(400, 'Discount code not found or expired.')
  if (doc.applicableTo !== 'both' && doc.applicableTo !== context) {
    throw new HttpError(400, context === 'order' ? 'This code is only valid for bookings.' : 'This code is only valid for product orders.')
  }
  if (doc.validFrom && new Date(doc.validFrom) > now) throw new HttpError(400, 'This code is not active yet.')
  if (doc.validUntil && new Date(doc.validUntil) < now) throw new HttpError(400, 'This discount code has expired.')
  if (doc.maxUses && (doc.usedCount ?? 0) >= doc.maxUses) throw new HttpError(400, 'This code has reached its usage limit.')
  if (doc.customerId && doc.customerId !== customerId) throw new HttpError(400, 'This code is not valid for your account.')
  if (doc.minOrderAmount && subtotal < doc.minOrderAmount) throw new HttpError(400, 'Minimum amount for this code not met.')

  return { doc, amount: discountAmount(doc, subtotal) }
}

export function discountAmount(doc: Pick<DiscountDoc, 'type' | 'value' | 'maxDiscountAmount'>, subtotal: number) {
  if (doc.type === 'percentage') {
    const d = Math.round((subtotal * doc.value) / 100)
    return Math.min(doc.maxDiscountAmount ? Math.min(d, doc.maxDiscountAmount) : d, subtotal)
  }
  return Math.min(doc.value, subtotal)
}

// Patch for the ledger transaction: conditional on the revision we validated,
// so a single-use code can't be redeemed twice concurrently.
export function consumeDiscount(doc: DiscountDoc) {
  return { id: doc._id, rev: doc._rev, set: { usedCount: (doc.usedCount ?? 0) + 1 } }
}
