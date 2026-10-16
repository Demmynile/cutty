import { NextResponse } from 'next/server'
import type { StylistPublic } from '@cutty/types'
import { serverClient } from '@/lib/server/sanity'
import { route } from '@/lib/server/http'
import { cached } from '@/lib/server/cache'
import { STYLISTS_PUBLIC } from '@/lib/server/proQueries'
import { distanceKm } from '@/lib/server/geo'

export const runtime = 'nodejs'

// Public directory of approved Cutty Pro stylists.
//   ?kind=barber|braider   only that kind (stylists who do both always match)
//   ?q=locs                name, skill, style or area contains the text
//   ?lat=6.45&lng=3.47     adds distanceKm and sorts nearest first; stylists
//                          without a work location go last
//   ?radiusKm=15           with lat/lng, drops anyone further away
export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams
  const kind = params.get('kind')
  const q = params.get('q')?.trim().toLowerCase().slice(0, 80)
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const near = params.has('lat') && params.has('lng') && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const radiusKm = Number(params.get('radiusKm')) || Infinity

  const all = await cached('stylists', 60, () => serverClient.fetch<StylistPublic[]>(STYLISTS_PUBLIC))
  let list = all.filter(
    (s) =>
      (kind !== 'barber' && kind !== 'braider' ? true : s.kind === kind || s.kind === 'both') &&
      (!q ||
        s.name.toLowerCase().includes(q) ||
        [s.location?.area, s.location?.city, s.location?.postcode].some((t) => t?.toLowerCase().includes(q)) ||
        [...s.skills, ...s.styles].some((t) => t.toLowerCase().includes(q))),
  )

  if (near) {
    list = list
      .map((s) => (s.location ? { ...s, distanceKm: distanceKm({ lat, lng }, s.location) } : s))
      .filter((s) => s.distanceKm === undefined || s.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    // A position makes the response personal, so only the plain directory is shared-cacheable.
    return NextResponse.json(list, { headers: { 'Cache-Control': 'private, max-age=30' } })
  }
  return NextResponse.json(list, { headers: { 'Cache-Control': 'public, max-age=60' } })
})
