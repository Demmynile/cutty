import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { BOOKING_BY_ID_FOR_CUSTOMER } from '@/lib/server/queries'

export const runtime = 'nodejs'

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { customerId } = await requireCustomer(req)
  const { id } = await params
  // Ownership is part of the query: another customer's booking is a 404.
  const booking = await serverClient.fetch(BOOKING_BY_ID_FOR_CUSTOMER, { id, customerId })
  if (!booking) throw new HttpError(404, 'Booking not found')
  return NextResponse.json(booking)
})
