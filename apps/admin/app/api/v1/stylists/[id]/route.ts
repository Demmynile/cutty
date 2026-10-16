import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import { cached } from '@/lib/server/cache'
import { STYLIST_PUBLIC_BY_ID } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

// A stylist's public profile: skills, styles, hours, services and shop.
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params
  if (id.length > 120) throw new HttpError(404, 'Stylist not found')
  const stylist = await cached(`stylist:${id}`, 60, () => serverClient.fetch(STYLIST_PUBLIC_BY_ID, { id }))
  if (!stylist) throw new HttpError(404, 'Stylist not found')
  return NextResponse.json(stylist, { headers: { 'Cache-Control': 'public, max-age=60' } })
})
