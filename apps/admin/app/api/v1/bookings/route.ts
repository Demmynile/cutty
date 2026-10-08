import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadDiscount, consumeDiscount } from '@/lib/server/discounts'
import { newId } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'
import { BOOKINGS_BY_CUSTOMER, SERVICES_BY_IDS, BARBER_AVAILABLE_BY_ID } from '@/lib/server/queries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(BOOKINGS_BY_CUSTOMER, { customerId }))
})

const schema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1).max(10),
  barberId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
  discountCode: z.string().trim().max(64).optional(),
})

// Prices and points come from the service documents, not the client.
// Loyalty points and the visit count are awarded when staff mark the booking
// completed (admin dashboard), so creating-then-cancelling earns nothing.
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  rateLimit(`booking:${customerId}`, 10, 60 * 60 * 1000)
  const body = await parseBody(req, schema)

  const ids = [...new Set(body.serviceIds)]
  const [services, barber] = await Promise.all([
    serverClient.fetch<Array<{ _id: string; price: number; pointsEarned?: number }>>(SERVICES_BY_IDS, { ids }),
    serverClient.fetch(BARBER_AVAILABLE_BY_ID, { id: body.barberId }),
  ])
  if (services.length !== ids.length) throw new HttpError(400, 'One or more services are no longer available.')
  if (!barber) throw new HttpError(400, 'That stylist is not available.')
  if (new Date(`${body.date}T${body.time}:00`) < new Date(Date.now() - 60_000)) {
    throw new HttpError(400, 'Please choose a time in the future.')
  }

  const totalAmount = services.reduce((sum, s) => sum + s.price, 0)
  const pointsEarned = services.reduce((sum, s) => sum + (s.pointsEarned ?? 0), 0)
  const discount = body.discountCode ? await loadDiscount(body.discountCode, 'booking', totalAmount, customerId) : null

  const _id = newId()
  const tx = serverClient.transaction().create({
    _id,
    _type: 'booking',
    customer: ref(customerId),
    barber: ref(body.barberId),
    services: ids.map((id) => ({ ...ref(id), _key: id })),
    bookingDate: body.date,
    startTime: body.time,
    totalAmount,
    discountAmount: discount?.amount ?? 0,
    pointsEarned,
    paymentMethod: 'cash',
    status: 'pending',
    notes: body.notes,
    ...(discount ? { discountCode: ref(discount.doc._id) } : {}),
    createdAt: now(),
  })
  if (discount) {
    const c = consumeDiscount(discount.doc)
    tx.patch(c.id, (p) => p.ifRevisionId(c.rev).set(c.set))
  }
  try {
    await tx.commit()
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 409) throw new HttpError(409, 'That discount code was just used. Please try again.')
    throw err
  }

  await audit({ action: 'booking.create', actor: { type: 'customer', id: customerId, email }, target: { type: 'booking', id: _id } })
  return NextResponse.json({ _id }, { status: 201 })
})
