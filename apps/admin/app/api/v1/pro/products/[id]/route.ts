import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { invalidateCatalog } from '@/lib/server/cache'
import { PRO_PRODUCT_BY_ID } from '@/lib/server/proQueries'
import { productSchema, productFields } from '@/lib/server/proSchemas'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

async function owned(id: string, stylistId: string) {
  const p = await serverClient.fetch<{ _id: string; _rev: string } | null>(PRO_PRODUCT_BY_ID, { id, stylistId })
  if (!p) throw new HttpError(404, 'Product not found')
  return p
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { stylistId } = await requireStylist(req, { shop: true })
  const product = await owned((await params).id, stylistId)
  const body = await parseBody(req, productSchema.partial().strict())
  const patch = serverClient.patch(product._id).ifRevisionId(product._rev).set(await productFields(body))
  if (body.compareAtPrice === null) patch.unset(['compareAtPrice'])
  if (body.categoryId === null) patch.unset(['category'])
  await patch.commit()
  await invalidateCatalog()
  return NextResponse.json({ ok: true })
})

// Products are referenced by past orders, so "delete" hides it from the shop.
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { stylistId } = await requireStylist(req, { shop: true })
  const product = await owned((await params).id, stylistId)
  await serverClient.patch(product._id).set({ isActive: false }).commit()
  await invalidateCatalog()
  return NextResponse.json({ ok: true })
})
