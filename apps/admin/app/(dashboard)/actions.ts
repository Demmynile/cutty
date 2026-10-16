'use server'

import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@cutty/types'
import { serverClient } from '@/lib/server/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { markOrderPaid } from '@/lib/server/orders'
import { audit } from '@/lib/server/audit'

const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
}

type Result = { ok: true } | { ok: false; error: string }

export async function advanceOrderStatus(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
  const order = await serverClient.fetch<{ _id: string; _rev: string; status: OrderStatus; orderNumber: string; customerId: string; pointsEarned?: number } | null>(
    `*[_type == "order" && _id == $id][0]{ _id, _rev, status, orderNumber, pointsEarned, "customerId": customer._ref }`,
    { id: orderId },
  )
  if (!order) return { ok: false, error: 'Order not found' }
  const next = ORDER_TRANSITIONS[order.status]
  if (!next) return { ok: false, error: 'No further status' }

  if (next === 'paid') {
    // Manually confirming an off-platform payment (e.g. bank transfer) is a
    // money decision: owners only, and it awards the order's points.
    if (admin.role !== 'owner') return { ok: false, error: 'Only an owner can mark an order as paid' }
    await markOrderPaid(order, { markedPaidBy: admin.email })
  } else {
    await serverClient.patch(order._id).ifRevisionId(order._rev).set({ status: next }).commit()
  }

  await audit({
    action: 'admin.order_status',
    actor: { type: 'admin', id: admin.id, email: admin.email },
    target: { type: 'order', id: orderId },
    details: { from: order.status, to: next },
  })
  revalidatePath('/orders')
  return { ok: true }
}
