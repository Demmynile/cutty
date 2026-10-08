'use server'

import { revalidatePath } from 'next/cache'
import type { BookingStatus, OrderStatus } from '@cutty/types'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { mutateCustomer, tierForVisits } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'

// Server-side copies of the allowed transitions — the buttons in the UI are a
// convenience; these are what's enforced.
const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
}

const ORDER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
}

type Result = { ok: true } | { ok: false; error: string }

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Result> {
  const admin = await requireAdmin()
  const booking = await serverClient.fetch<{ _id: string; _rev: string; status: BookingStatus; customerId: string; pointsEarned?: number } | null>(
    `*[_type == "booking" && _id == $id][0]{ _id, _rev, status, pointsEarned, "customerId": customer._ref }`,
    { id: bookingId },
  )
  if (!booking) return { ok: false, error: 'Booking not found' }
  if (!BOOKING_TRANSITIONS[booking.status]?.includes(status)) return { ok: false, error: `Can't move a ${booking.status} booking to ${status}` }

  if (status === 'completed') {
    // Points and the visit (which drives tier) are earned on completion only.
    const points = booking.pointsEarned ?? 0
    await mutateCustomer(booking.customerId, (c) => {
      const visits = c.totalVisits + 1
      return {
        set: { loyaltyPoints: c.loyaltyPoints + points, totalVisits: visits, tier: tierForVisits(visits) },
        patch: [{ id: booking._id, rev: booking._rev, set: { status, completedAt: now() } }],
        create: points > 0 ? [{
          _type: 'loyaltyTransaction', customer: ref(booking.customerId), type: 'earn', points,
          balanceAfter: c.loyaltyPoints + points, description: 'Points earned from booking', source: 'booking',
          referenceId: booking._id, createdAt: now(),
        }] : [],
        result: null,
      }
    })
  } else {
    await serverClient.patch(booking._id).ifRevisionId(booking._rev).set({ status }).commit()
  }

  await audit({
    action: 'admin.booking_status',
    actor: { type: 'admin', id: admin.id, email: admin.email },
    target: { type: 'booking', id: bookingId },
    details: { from: booking.status, to: status },
  })
  revalidatePath('/bookings')
  return { ok: true }
}

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
    const points = order.pointsEarned ?? 0
    await mutateCustomer(order.customerId, (c) => ({
      set: { loyaltyPoints: c.loyaltyPoints + points },
      patch: [{ id: order._id, rev: order._rev, set: { status: 'paid', paidAt: now(), markedPaidBy: admin.email } }],
      create: points > 0 ? [{
        _type: 'loyaltyTransaction', customer: ref(order.customerId), type: 'earn', points,
        balanceAfter: c.loyaltyPoints + points, description: `Points from Order #${order.orderNumber}`, source: 'order',
        referenceId: order._id, createdAt: now(),
      }] : [],
      result: null,
    }))
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
