import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { CONVERSATIONS_FOR_STYLIST } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { stylistId } = await requireStylist(req, { approved: true })
  return NextResponse.json(await serverClient.fetch(CONVERSATIONS_FOR_STYLIST, { stylistId }))
})
