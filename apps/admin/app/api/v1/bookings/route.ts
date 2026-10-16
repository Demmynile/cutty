import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { assertSlotFree, shopNow, toMinutes } from '@/lib/server/availability'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadDiscount, consumeDiscount } from '@/lib/server/discounts'
import { newId } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'
import { bookingPoints } from '@/lib/server/bookings'
import { BOOKINGS_BY_CUSTOMER, BOOKABLE_STYLIST_BY_BARBER_ID } from '@/lib/server/queries'

export const runtime = 'nodejs'

const MAX_ACTIVE_BOOKINGS = 5

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(BOOKINGS_BY_CUSTOMER, { customerId }))
})

const schema = z.object({
  barberId: z.string().min(1),
  style: z.string().trim().min(1).max(60).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
  discountCode: z.string().trim().max(64).optional(),
})

// Customers book a stylist, not a service: price, length and points come
// from the stylist's own appointment price, never the client. Loyalty points and the visit count are awarded when staff mark the booking
// completed (admin dashboard), so creating-then-cancelling earns nothing.
export const POST = route(async (req) => {
  const { customerId, email } = await requireCustomer(req)
  await rateLimit(`booking:${customerId}`, 10, 60 * 60 * 1000)
  const body = await parseBody(req, schema)

  const stylist = await serverClient.fetch<{ _id: string; styles: string[]; bookingPrice: number; bookingDuration: number } | null>(
    BOOKABLE_STYLIST_BY_BARBER_ID, { id: body.barberId },
  )
  if (!stylist) throw new HttpError(400, 'That stylist is not taking bookings right now.')
  if (body.style && !stylist.styles.includes(body.style)) throw new HttpError(400, "That style isn't one this stylist offers.")
  const today = shopNow()
  // Unpaid bookings hold stylists' time, so one customer can't block a day.
  const active = await serverClient.fetch<number>(
    `count(*[_type == "booking" && customer._ref == $customerId && status in ["pending", "confirmed"] && bookingDate >= $today])`,
    { customerId, today: today.date },
  )
  if (active >= MAX_ACTIVE_BOOKINGS) {
    throw new HttpError(400, `You already have ${MAX_ACTIVE_BOOKINGS} upcoming bookings. Please attend or cancel one before booking again.`)
  }
  if (body.date < today.date || (body.date === today.date && toMinutes(body.time) <= today.minutes)) {
    throw new HttpError(400, 'Please choose a time in the future.')
  }
  const endTime = await assertSlotFree(body.barberId, body.date, body.time, stylist.bookingDuration)

  const totalAmount = stylist.bookingPrice
  const pointsEarned = bookingPoints(totalAmount)
  const discount = body.discountCode ? await loadDiscount(body.discountCode, 'booking', totalAmount, customerId) : null

  const _id = newId()
  const tx = serverClient.transaction().create({
    _id,
    _type: 'booking',
    customer: ref(customerId),
    barber: ref(body.barberId),
    ...(body.style ? { style: body.style } : {}),
    bookingDate: body.date,
    startTime: body.time,
    endTime,
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
