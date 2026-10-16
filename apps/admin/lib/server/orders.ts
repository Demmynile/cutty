import 'server-only'
import { ref, now } from './sanity'
import { mutateCustomer } from './ledger'

/**
 * Marks a pending order paid after an off-platform payment (bank transfer)
 * is confirmed, and credits the order's loyalty points in the same
 * transaction. The order patch is conditional on `rev`.
 */
export async function markOrderPaid(
  order: { _id: string; _rev: string; orderNumber: string; customerId: string; pointsEarned?: number },
  extra: Record<string, unknown>,
) {
  const points = order.pointsEarned ?? 0
  await mutateCustomer(order.customerId, (c) => ({
    set: { loyaltyPoints: c.loyaltyPoints + points },
    patch: [{ id: order._id, rev: order._rev, set: { status: 'paid', paidAt: now(), ...extra } }],
    create: points > 0 ? [{
      _type: 'loyaltyTransaction', customer: ref(order.customerId), type: 'earn', points,
      balanceAfter: c.loyaltyPoints + points, description: `Points from Order #${order.orderNumber}`, source: 'order',
      referenceId: order._id, createdAt: now(),
    }] : [],
    result: null,
  }))
}
