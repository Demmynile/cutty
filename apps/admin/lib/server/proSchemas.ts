import 'server-only'
import { z } from 'zod'
import { serverClient, ref } from './sanity'
import { HttpError } from './http'
import { imageValue } from './stylists'

// Request schemas shared by Cutty Pro route handlers (route files may only
// export HTTP handlers, so shared pieces live here).

// Where a stylist works: a map pin plus the address it was picked or looked
// up from. Shared by sign-up and profile edits.
const addressPart = (max: number) => z.string().trim().max(max).optional()
export const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    area: addressPart(80),
    address: addressPart(200),
    city: addressPart(80),
    state: addressPart(80),
    postcode: addressPart(12),
  })
  .strict()

/** The Sanity `location` object, dropping empty address parts. */
export function locationValue(l: z.infer<typeof locationSchema>) {
  const parts = Object.fromEntries((['area', 'address', 'city', 'state', 'postcode'] as const).filter((k) => l[k]).map((k) => [k, l[k]]))
  return { point: { _type: 'geopoint', lat: l.lat, lng: l.lng }, ...parts }
}

export const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  price: z.number().int().min(100).max(100_000_000),
  compareAtPrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(100_000),
  categoryId: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  imageAssetIds: z.array(z.string().max(120)).max(6).optional(),
  isActive: z.boolean().optional(),
})

export type ProductInput = z.infer<typeof productSchema>

// Turns validated input into Sanity fields. Description is stored as one
// portable-text block per paragraph so it renders like shop products.
export async function productFields(body: Partial<ProductInput>) {
  const fields: Record<string, unknown> = {}
  if (body.name !== undefined) fields.name = body.name
  if (body.price !== undefined) {
    fields.price = body.price
    fields.pointsEarned = Math.floor(body.price / 10_000)
  }
  if (body.stock !== undefined) fields.stock = body.stock
  if (body.tags !== undefined) fields.tags = body.tags
  if (body.isActive !== undefined) fields.isActive = body.isActive
  if (body.compareAtPrice !== undefined && body.compareAtPrice !== null) fields.compareAtPrice = body.compareAtPrice
  if (body.description !== undefined) {
    fields.description = body.description.split(/\n{2,}/).filter(Boolean).map((text, i) => ({
      _type: 'block', _key: `p${i}`, style: 'normal', markDefs: [],
      children: [{ _type: 'span', _key: `s${i}`, text, marks: [] }],
    }))
  }
  if (body.imageAssetIds !== undefined) fields.images = body.imageAssetIds.map((id, i) => imageValue(id, `img${i}`))
  if (body.categoryId) {
    const exists = await serverClient.fetch<number>(`count(*[_type == "category" && _id == $id])`, { id: body.categoryId })
    if (!exists) throw new HttpError(400, 'Unknown category')
    fields.category = ref(body.categoryId)
  }
  return fields
}

