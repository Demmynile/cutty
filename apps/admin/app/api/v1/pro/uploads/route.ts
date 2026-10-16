import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { uploadImage, MAX_UPLOAD_BASE64_CHARS } from '@/lib/server/stylists'

export const runtime = 'nodejs'
export const maxDuration = 30

const schema = z.object({
  base64: z.string().min(1).max(MAX_UPLOAD_BASE64_CHARS),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  purpose: z.enum(['photo', 'product']),
})

// Profile photos and product images. Returns the asset id the app then sends
// in PATCH /pro/me (photoAssetId) or the product's imageAssetIds.
export const POST = route(async (req) => {
  const { stylistId } = await requireStylist(req)
  await rateLimit(`pro-upload:${stylistId}`, 40, 60 * 60 * 1000)
  const { base64, mediaType, purpose } = await parseBody(req, schema)
  const image = await uploadImage(base64, mediaType, `${purpose}-${stylistId}.${mediaType.split('/')[1]}`)
  return NextResponse.json({ assetId: image.asset._ref, image }, { status: 201 })
})
