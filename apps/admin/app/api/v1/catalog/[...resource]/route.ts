import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import { cached } from '@/lib/server/cache'
import {
  PRODUCTS_ACTIVE, PRODUCTS_FEATURED,
  PRODUCT_BY_SLUG, CATEGORIES_ALL, EXCHANGE_RATES,
} from '@/lib/server/queries'

export const runtime = 'nodejs'

// Public shop catalogue (no sign-in needed). Only fixed, allow-listed queries
// run here — clients can't send arbitrary GROQ, so customer data is unreachable.
// Results are shared by every customer, so they're cached in Redis when it's configured.
const TTL = 60
const fetchCached = <T>(key: string, query: string, params: Record<string, string> = {}) =>
  cached<T>(key, TTL, () => serverClient.fetch<T>(query, params))

export const GET = route<{ params: Promise<{ resource: string[] }> }>(async (req, { params }) => {
  const [resource, arg] = (await params).resource
  const featured = new URL(req.url).searchParams.get('featured') === '1'

  // Bounded so junk slugs can't be used to fill the cache.
  if (arg && arg.length > 200) throw new HttpError(404, 'Product not found')

  let data: unknown
  switch (resource) {
    case 'categories': data = await fetchCached('categories', CATEGORIES_ALL); break
    case 'exchange-rates': data = await fetchCached('exchange-rates', EXCHANGE_RATES); break
    case 'products':
      data = arg
        ? await fetchCached(`product:${arg}`, PRODUCT_BY_SLUG, { slug: arg })
        : featured
          ? await fetchCached('products:featured', PRODUCTS_FEATURED)
          : await fetchCached('products', PRODUCTS_ACTIVE)
      if (arg && !data) throw new HttpError(404, 'Product not found')
      break
    default:
      throw new HttpError(404, 'Not found')
  }
  return NextResponse.json(data ?? null, { headers: { 'Cache-Control': 'public, max-age=60' } })
})
