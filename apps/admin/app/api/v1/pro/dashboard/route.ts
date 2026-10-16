import { NextResponse } from 'next/server'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { dashboard } from '@/lib/server/stylistStats'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { stylistId, barberId, status, shopStatus } = await requireStylist(req)
  return NextResponse.json(await dashboard({ stylistId, barberId, status, shopStatus }))
})
