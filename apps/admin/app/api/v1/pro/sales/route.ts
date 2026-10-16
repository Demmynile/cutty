import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { PRO_SALES } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

const STATUSES = ['all', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

export const GET = route(async (req) => {
  const { stylistId } = await requireStylist(req, { shop: true })
  const requested = new URL(req.url).searchParams.get('status') ?? 'all'
  const status = STATUSES.includes(requested) ? requested : 'all'
  return NextResponse.json(await serverClient.fetch(PRO_SALES, { stylistId, status }))
})
