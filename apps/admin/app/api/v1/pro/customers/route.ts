import { NextResponse } from 'next/server'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { customerStats } from '@/lib/server/stylistStats'

export const runtime = 'nodejs'

// The stylist's customers: visits, products bought, spend and bonuses given.
export const GET = route(async (req) => {
  const { stylistId, barberId } = await requireStylist(req, { approved: true })
  return NextResponse.json(await customerStats(stylistId, barberId))
})
