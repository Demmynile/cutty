import 'server-only'
import { FEATURES, type AISearchResult } from '@cutty/types'
import { serverClient } from './sanity'

const SEARCH_PROJECTION = `{
  _id, query, summary, styles, createdAt,
  "stylists": stylists[defined(stylist->_id) && stylist->status == "approved"]{
    reason, "stylist": stylist->{ _id, "name": coalesce(displayName, fullName), kind, photo, rating, "skills": coalesce(skills, []) }
  },
  "products": products[defined(product->_id) && product->isActive == true]{
    reason, "product": product->{ _id, name, slug, images, price, stock }
  }
}`

// While the shop is off (FEATURES.shop) results never carry products.
const withoutShop = <T extends AISearchResult | null>(r: T): T => (r && !FEATURES.shop ? { ...r, products: [] } : r)

export async function hydrateSearch(searchId: string): Promise<AISearchResult | null> {
  return withoutShop(await serverClient.fetch<AISearchResult | null>(`*[_type == "aiSearch" && _id == $id][0]${SEARCH_PROJECTION}`, { id: searchId }))
}

// "Recommended for you": the customer's latest AI search, re-read so stylists
// or products that went away since are dropped. Falls back to top-rated
// stylists and featured products for customers who haven't searched yet.
export async function recommendationsFor(customerId: string): Promise<AISearchResult & { personalized: boolean }> {
  const latest = await serverClient.fetch<AISearchResult | null>(
    `*[_type == "customer" && _id == $customerId][0].latestSearch->${SEARCH_PROJECTION}`,
    { customerId },
  )
  if (latest && (latest.stylists.length || (FEATURES.shop && latest.products.length))) return { ...withoutShop(latest), personalized: true }

  const fallback = await serverClient.fetch<{ stylists: AISearchResult['stylists']; products: AISearchResult['products'] }>(`{
    "stylists": *[_type == "stylist" && status == "approved" && isActive != false && defined(barber)] | order(coalesce(rating, 0) desc)[0...5]{
      "reason": "Top rated on Cutty", "stylist": @{ _id, "name": coalesce(displayName, fullName), kind, photo, rating, "skills": coalesce(skills, []) }
    },
    "products": *[_type == "product" && isActive == true && isFeatured == true][0...6]{
      "reason": "Popular in the shop", "product": @{ _id, name, slug, images, price, stock }
    }
  }`)
  return { ...withoutShop({ query: '', summary: 'Search with Cutty AI to get picks made for you.', styles: [], ...fallback }), personalized: false }
}
