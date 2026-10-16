import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { changeBookingStatus } from '@/lib/server/bookings'

export const runtime = 'nodejs'

// Stylists run their own chair: accept (confirm), start, complete, cancel or
// mark a no-show — only on bookings with their own bookable profile. Apart
// from a customer cancelling their own booking, only the stylist changes a
// booking's status; the admin dashboard is read-only.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { stylistId, email, barberId } = await requireStylist(req, { approved: true })
  if (!barberId) throw new HttpError(404, 'Booking not found')
  const { status } = await parseBody(req, z.object({ status: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']) }))
  const result = await changeBookingStatus({
    bookingId: (await params).id,
    status,
    barberId,
    actor: { type: 'stylist', id: stylistId, email },
  })
  if (!result.ok) throw new HttpError(400, result.error)
  return NextResponse.json({ ok: true })
})
