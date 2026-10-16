import 'server-only'
import type { BookingStatus } from '@cutty/types'
import { serverClient, ref, now } from './sanity'
import { mutateCustomer, tierForVisits } from './ledger'
import { audit, type AuditActor } from './audit'
import { bookingPointsThisMonth, marketplaceSettings } from './stylistStats'

// Server-side copies of the allowed transitions — the buttons in the Cutty Pro
// app are a convenience; these are what's enforced.
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
}

type Result = { ok: true } | { ok: false; error: string }

/** Loyalty points a booking earns once completed: the shop rule of 1 point per ₦100. */
export const bookingPoints = (kobo: number) => Math.floor(kobo / 10_000)

/**
 * Moves a booking to `status`. Only the booked stylist does this, from the
 * Cutty Pro app (admins can view bookings but not accept or change them).
 * Completing one credits the customer's points and visit (which drives tier).
 * `barberId` is the stylist's calendar: other stylists' bookings aren't found.
 */
export async function changeBookingStatus(args: {
  bookingId: string
  status: BookingStatus
  actor: AuditActor & { type: 'stylist' }
  barberId: string
}): Promise<Result> {
  const { bookingId, status, actor, barberId } = args
  const booking = await serverClient.fetch<{
    _id: string; _rev: string; status: BookingStatus; customerId: string; barberId: string; pointsEarned?: number
  } | null>(
    `*[_type == "booking" && _id == $id][0]{ _id, _rev, status, pointsEarned, "customerId": customer._ref, "barberId": barber._ref }`,
    { id: bookingId },
  )
  if (!booking || booking.barberId !== barberId) return { ok: false, error: 'Booking not found' }
  if (!BOOKING_TRANSITIONS[booking.status]?.includes(status)) {
    return { ok: false, error: `Can't move a ${booking.status.replace('_', ' ')} booking to ${status.replace('_', ' ')}` }
  }

  let pointsCapped: { from: number; to: number } | undefined
  if (status === 'completed') {
    let points = booking.pointsEarned ?? 0
    // A stylist completing their own booking is unverified (cash, no payment
    // record), and appointment prices are set by the stylist, so the points it
    // can mint are capped per visit and per month.
    const stylistId = actor.id
    if (points > 0) {
      const [settings, used] = await Promise.all([marketplaceSettings(), bookingPointsThisMonth(stylistId)])
      const allowed = Math.max(0, Math.min(points, settings.bookingPointsMaxPerVisit, settings.bookingPointsMonthlyCap - used))
      if (allowed < points) pointsCapped = { from: points, to: allowed }
      points = allowed
    }
    await mutateCustomer(booking.customerId, (c) => {
      const visits = c.totalVisits + 1
      return {
        set: { loyaltyPoints: c.loyaltyPoints + points, totalVisits: visits, tier: tierForVisits(visits) },
        patch: [{ id: booking._id, rev: booking._rev, set: { status, completedAt: now() } }],
        create: points > 0 ? [{
          _type: 'loyaltyTransaction', customer: ref(booking.customerId), type: 'earn', points,
          balanceAfter: c.loyaltyPoints + points, description: 'Points earned from booking', source: 'booking',
          referenceId: booking._id, createdAt: now(), stylist: ref(stylistId),
        }] : [],
        result: null,
      }
    })
  } else {
    await serverClient.patch(booking._id).ifRevisionId(booking._rev).set({ status }).commit()
  }

  await audit({
    action: 'stylist.booking_status',
    actor,
    target: { type: 'booking', id: bookingId },
    details: { from: booking.status, to: status, ...(pointsCapped ? { pointsCapped } : {}) },
  })
  return { ok: true }
}
