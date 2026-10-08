import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { audit } from '@/lib/server/audit'

export const runtime = 'nodejs'

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { customerId, email } = await requireCustomer(req)
  const { id } = await params

  const booking = await serverClient.fetch<{ _id: string; _rev: string; status: string } | null>(
    `*[_type == "booking" && _id == $id && customer._ref == $customerId][0]{ _id, _rev, status }`,
    { id, customerId },
  )
  if (!booking) throw new HttpError(404, 'Booking not found')
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new HttpError(400, 'This booking can no longer be cancelled.')
  }

  await serverClient
    .patch(booking._id)
    .ifRevisionId(booking._rev)
    .set({ status: 'cancelled', cancelReason: 'Cancelled by customer' })
    .commit()

  await audit({ action: 'booking.cancel', actor: { type: 'customer', id: customerId, email }, target: { type: 'booking', id } })
  return NextResponse.json({ ok: true })
})
