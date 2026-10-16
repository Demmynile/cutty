import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { PRO_BOOKINGS } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

const STATUSES = ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']

export const GET = route(async (req) => {
  const { barberId } = await requireStylist(req, { approved: true })
  if (!barberId) return NextResponse.json([])
  const requested = new URL(req.url).searchParams.get('status') ?? 'all'
  const status = STATUSES.includes(requested) ? requested : 'all'
  return NextResponse.json(await serverClient.fetch(PRO_BOOKINGS, { barberId, status }))
})
