import { NextResponse } from 'next/server'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { newId } from '@/lib/server/ledger'
import { audit } from '@/lib/server/audit'
import { invalidateCatalog } from '@/lib/server/cache'
import { slugify } from '@/lib/server/stylists'
import { productSchema, productFields } from '@/lib/server/proSchemas'
import { PRO_PRODUCTS } from '@/lib/server/proQueries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { stylistId } = await requireStylist(req, { shop: true })
  return NextResponse.json(await serverClient.fetch(PRO_PRODUCTS, { stylistId }))
})

export const POST = route(async (req) => {
  const { stylistId, email } = await requireStylist(req, { shop: true })
  const body = await parseBody(req, productSchema)
  const _id = newId()
  await serverClient.create({
    _id,
    _type: 'product',
    ...(await productFields(body)),
    slug: { _type: 'slug', current: `${slugify(body.name)}-${_id.slice(0, 6)}` },
    isActive: body.isActive ?? true,
    isFeatured: false,
    seller: ref(stylistId),
    createdAt: now(),
  })
  await invalidateCatalog()
  await audit({ action: 'stylist.product_create', actor: { type: 'stylist', id: stylistId, email }, target: { type: 'product', id: _id } })
  return NextResponse.json({ _id }, { status: 201 })
})
