import { NextResponse } from 'next/server'
import { z } from 'zod'
import { z as z4 } from 'zod/v4'
import { generateObject, NoObjectGeneratedError } from 'ai'
import { FEATURES, TRY_ON_STYLES, type AISearchResult } from '@cutty/types'
import { serverClient, ref, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { newId } from '@/lib/server/ledger'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { AI_SEARCH_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { hydrateSearch } from '@/lib/server/recommendations'

export const runtime = 'nodejs'
export const maxDuration = 60

const pick = z4.object({ id: z4.string(), reason: z4.string() })
const outputSchema = z4.object({
  summary: z4.string(),
  stylists: z4.array(pick).max(5),
  products: z4.array(pick).max(6),
  styles: z4.array(z4.string()).max(4),
})

type Catalogue = {
  stylists: Array<{ _id: string; name: string; kind: string; skills?: string[]; styles?: string[]; rating?: number; weeklyAvailability?: Array<{ day: string; start: string; end: string }>; bookingPrice?: number; bookingDuration?: number }>
  products: Array<{ _id: string; name: string; price: number; stock?: number; tags?: string[]; category?: string; seller?: string }>
  history: { visits: number; tier: string; recent: string[] }
}

// "Knotless braids on Saturday under ₦30k" → ranked stylists, products and
// try-on looks. The model only chooses among ids we give it; anything else is
// dropped. The saved result becomes the customer's "Recommended for you".
export const POST = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  await rateLimit(`ai:search:${customerId}`, 15, 60 * 60 * 1000)
  const { query } = await parseBody(req, z.object({ query: z.string().trim().min(2).max(300) }))

  const catalogue = await serverClient.fetch<Catalogue>(
    `{
      "stylists": *[_type == "stylist" && status == "approved" && isActive != false && defined(barber)][0...60]{
        _id, "name": coalesce(displayName, fullName), kind, skills, styles, rating, weeklyAvailability, bookingPrice, bookingDuration
      },
      "products": *[_type == "product" && isActive == true && coalesce(stock, 1) > 0][0...120]{
        _id, name, price, stock, tags, "category": category->name, "seller": seller->shop.name
      },
      "history": *[_type == "customer" && _id == $customerId][0]{
        "visits": coalesce(totalVisits, 0), "tier": coalesce(tier, "bronze"),
        "recent": *[_type == "aiSearch" && customer._ref == $customerId] | order(createdAt desc)[0...3].query
      }
    }`,
    { customerId },
  )

  // Shop is off for this release: only stylists and looks are offered.
  if (!FEATURES.shop) catalogue.products = []

  const naira = (k: number) => `₦${Math.round(k / 100)}`
  const prompt = [
    `Customer query: ${query}`,
    `Customer: ${catalogue.history?.visits ?? 0} visits, ${catalogue.history?.tier ?? 'bronze'} tier. Earlier searches: ${catalogue.history?.recent?.join(' | ') || 'none'}`,
    '',
    'STYLISTS',
    ...catalogue.stylists.map((s) =>
      `${s._id} | ${s.name} | ${s.kind} | rating ${s.rating ?? 'new'} | skills: ${(s.skills ?? []).join(', ')} | styles: ${(s.styles ?? []).join(', ')} | hours: ${(s.weeklyAvailability ?? []).map((w) => `${w.day.slice(0, 3)} ${w.start}-${w.end}`).join(', ') || 'not set'} | appointment: ${s.bookingPrice != null ? `${naira(s.bookingPrice)} ${s.bookingDuration ?? 60}min` : 'price not set'}`),
    '',
    'PRODUCTS',
    ...catalogue.products.map((p) => `${p._id} | ${p.name} | ${naira(p.price)} | ${p.category ?? ''} | ${(p.tags ?? []).join(', ')} | sold by ${p.seller ?? 'Cutty'}`),
    '',
    'TRY-ON STYLE IDS',
    TRY_ON_STYLES.map((s) => `${s.id} (${s.label})`).join(', '),
  ].join('\n')

  let object: z4.infer<typeof outputSchema>
  try {
    ;({ object } = await generateObject({ model: AI_MODEL, schema: outputSchema, providerOptions: AI_PROVIDER_OPTIONS, system: AI_SEARCH_SYSTEM_PROMPT, prompt }))
  } catch (err) {
    console.error('[ai/search]', err)
    if (NoObjectGeneratedError.isInstance(err)) throw new HttpError(502, 'Search failed, try again')
    throw new HttpError(502, 'AI search is not available right now.')
  }

  const stylistIds = new Set(catalogue.stylists.map((s) => s._id))
  const productIds = new Set(catalogue.products.map((p) => p._id))
  const styleIds = new Set(TRY_ON_STYLES.map((s) => s.id))
  const stylists = object.stylists.filter((p) => stylistIds.has(p.id))
  const products = object.products.filter((p) => productIds.has(p.id))
  const styles = object.styles.filter((id) => styleIds.has(id))

  const _id = newId()
  await serverClient
    .transaction()
    .create({
      _id,
      _type: 'aiSearch',
      customer: ref(customerId),
      query,
      summary: object.summary,
      stylists: stylists.map((p, i) => ({ _key: `s${i}`, stylist: ref(p.id), reason: p.reason })),
      products: products.map((p, i) => ({ _key: `p${i}`, product: ref(p.id), reason: p.reason })),
      styles,
      createdAt: now(),
    })
    .patch(customerId, (p) => p.set({ latestSearch: ref(_id) }))
    .commit()

  return NextResponse.json((await hydrateSearch(_id)) satisfies AISearchResult | null)
})
