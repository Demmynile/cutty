import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { loadAccount, syncBarber, imageValue } from '@/lib/server/stylists'
import { locationSchema, locationValue } from '@/lib/server/proSchemas'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { stylistId } = await requireStylist(req)
  return NextResponse.json(await loadAccount(stylistId))
})

const tag = z.string().trim().min(1).max(60)

// Allow-list of self-editable profile fields. Status, shop, rating and the
// linked barber are only ever set by the server or an admin.
const patchSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60).nullable(),
    phone: z.string().trim().min(10).max(20),
    kind: z.enum(['barber', 'braider', 'both']),
    bio: z.string().trim().max(1000).nullable(),
    yearsExperience: z.number().int().min(0).max(70).nullable(),
    skills: z.array(tag).max(30),
    styles: z.array(tag).max(60),
    // One appointment's price (kobo) and length: customers book the stylist, not a service.
    bookingPrice: z.number().int().min(100).max(100_000_000),
    bookingDuration: z.number().int().min(15).max(720),
    photoAssetId: z.string().max(120),
    awayAssistant: z.object({ enabled: z.boolean(), notes: z.string().trim().max(2000).nullable() }).strict(),
    location: locationSchema.nullable(),
  })
  .partial()
  .strict()

export const PATCH = route(async (req) => {
  const { stylistId } = await requireStylist(req)
  const { photoAssetId, displayName, bio, yearsExperience, skills, styles, awayAssistant, location, ...rest } = await parseBody(req, patchSchema)

  const patch = serverClient.patch(stylistId).set(rest)
  if (awayAssistant) {
    patch.set({ awayAssistant: { enabled: awayAssistant.enabled, ...(awayAssistant.notes ? { notes: awayAssistant.notes } : {}) } })
  }
  if (location === null) patch.unset(['location'])
  else if (location) patch.set({ location: locationValue(location) })
  if (skills) patch.set({ skills: [...new Set(skills)] })
  if (styles) patch.set({ styles: [...new Set(styles)] })
  if (photoAssetId) patch.set({ photo: imageValue(photoAssetId) })
  for (const [key, value] of Object.entries({ displayName, bio, yearsExperience })) {
    if (value === null) patch.unset([key])
    else if (value !== undefined) patch.set({ [key]: value })
  }
  await patch.commit()
  await syncBarber(stylistId)
  return NextResponse.json(await loadAccount(stylistId))
})
