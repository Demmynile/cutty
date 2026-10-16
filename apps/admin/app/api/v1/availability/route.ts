import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, HttpError } from '@/lib/server/http'
import { freeSlots } from '@/lib/server/availability'

export const runtime = 'nodejs'

const query = z.object({
  barberId: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().int().min(5).max(720),
})

// Free start times for a barber on a date, given the booking's total duration.
export const GET = route(async (req) => {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) throw new HttpError(400, 'Invalid request')
  const { barberId, date, duration } = parsed.data
  return NextResponse.json({ slots: await freeSlots(barberId, date, duration) }, { headers: { 'Cache-Control': 'no-store' } })
})
