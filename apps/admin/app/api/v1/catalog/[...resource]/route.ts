import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import {
  SERVICES_ACTIVE, BARBERS_AVAILABLE, PRODUCTS_ACTIVE, PRODUCTS_FEATURED,
  PRODUCT_BY_SLUG, CATEGORIES_ALL, EXCHANGE_RATES,
} from '@/lib/server/queries'

export const runtime = 'nodejs'

// Public shop catalogue (no sign-in needed). Only fixed, allow-listed queries
// run here — clients can't send arbitrary GROQ, so customer data is unreachable.
export const GET = route<{ params: Promise<{ resource: string[] }> }>(async (req, { params }) => {
  const [resource, arg] = (await params).resource
  const featured = new URL(req.url).searchParams.get('featured') === '1'

  let data: unknown
  switch (resource) {
    case 'services': data = await serverClient.fetch(SERVICES_ACTIVE); break
    case 'barbers': data = await serverClient.fetch(BARBERS_AVAILABLE); break
    case 'categories': data = await serverClient.fetch(CATEGORIES_ALL); break
    case 'exchange-rates': data = await serverClient.fetch(EXCHANGE_RATES); break
    case 'products':
      data = arg
        ? await serverClient.fetch(PRODUCT_BY_SLUG, { slug: arg })
        : await serverClient.fetch(featured ? PRODUCTS_FEATURED : PRODUCTS_ACTIVE)
      if (arg && !data) throw new HttpError(404, 'Product not found')
      break
    default:
      throw new HttpError(404, 'Not found')
  }
  return NextResponse.json(data ?? null, { headers: { 'Cache-Control': 'public, max-age=60' } })
})
