import 'server-only'
import type { LoyaltyTier, SanityImage, StylistCustomerStat, StylistDashboard, StylistSale } from '@cutty/types'
import { serverClient } from './sanity'
import { shopNow } from './availability'

const SOLD = ['paid', 'processing', 'shipped', 'delivered']

type Raw = {
  completed: Array<{ customerId: string; amount: number; date: string }>
  sales: Array<{ customerId: string; amount: number; qty: number; createdAt: string }>
  bonuses: Array<{ customerId: string; points: number; createdAt: string }>
  customers: Array<{ _id: string; fullName: string; avatar?: SanityImage; tier?: LoyaltyTier }>
}

// Everything a stylist's dashboard and customer list need, in one query.
// A "customer" is anyone with a completed booking or a paid order with them.
const RAW = `{
  "completed": *[_type == "booking" && barber._ref == $barberId && status == "completed"]{
    "customerId": customer._ref, "amount": coalesce(totalAmount, 0) - coalesce(discountAmount, 0), "date": bookingDate
  },
  "sales": *[_type == "order" && seller._ref == $stylistId && status in $sold]{
    "customerId": customer._ref, "amount": coalesce(totalAmount, 0), "qty": math::sum(items[].quantity), createdAt
  },
  "bonuses": *[_type == "loyaltyTransaction" && stylist._ref == $stylistId && type == "bonus"]{
    "customerId": customer._ref, points, createdAt
  }
}{
  ...,
  "customers": *[_type == "customer" && _id in (^.completed[].customerId + ^.sales[].customerId)]{ _id, fullName, avatar, tier }
}`

async function loadRaw(stylistId: string, barberId?: string): Promise<Raw> {
  return serverClient.fetch<Raw>(RAW, { stylistId, barberId: barberId ?? '__none__', sold: SOLD })
}

export function monthStart() {
  return `${shopNow().date.slice(0, 7)}-01T00:00:00Z`
}

export async function bonusGivenThisMonth(stylistId: string) {
  return serverClient.fetch<number>(
    `coalesce(math::sum(*[_type == "loyaltyTransaction" && stylist._ref == $stylistId && type == "bonus" && createdAt >= $since].points), 0)`,
    { stylistId, since: monthStart() },
  )
}

export async function marketplaceSettings() {
  const m = await serverClient.fetch<{
    commissionPercent?: number; bonusMaxPerAward?: number; bonusMonthlyCap?: number
    bookingPointsMaxPerVisit?: number; bookingPointsMonthlyCap?: number
  } | null>(`*[_type == "settings"][0].marketplace`)
  return {
    commissionPercent: m?.commissionPercent ?? 10,
    bonusMaxPerAward: m?.bonusMaxPerAward ?? 200,
    bonusMonthlyCap: m?.bonusMonthlyCap ?? 2000,
    bookingPointsMaxPerVisit: m?.bookingPointsMaxPerVisit ?? 300,
    bookingPointsMonthlyCap: m?.bookingPointsMonthlyCap ?? 5000,
  }
}

/** Points credited this month for bookings a stylist marked completed themselves. */
export async function bookingPointsThisMonth(stylistId: string) {
  return serverClient.fetch<number>(
    `coalesce(math::sum(*[_type == "loyaltyTransaction" && stylist._ref == $stylistId && source == "booking" && createdAt >= $since].points), 0)`,
    { stylistId, since: monthStart() },
  )
}

export async function customerStats(stylistId: string, barberId?: string): Promise<StylistCustomerStat[]> {
  const raw = await loadRaw(stylistId, barberId)
  const byId = new Map<string, StylistCustomerStat>()
  const entry = (id: string) => {
    let e = byId.get(id)
    if (!e) {
      const c = raw.customers.find((x) => x._id === id)
      e = { customerId: id, name: c?.fullName ?? 'Customer', avatar: c?.avatar, tier: c?.tier ?? 'bronze', visits: 0, productsPurchased: 0, totalSpent: 0, bonusGiven: 0 }
      byId.set(id, e)
    }
    return e
  }
  for (const b of raw.completed) {
    const e = entry(b.customerId)
    e.visits += 1
    e.totalSpent += b.amount
    if (!e.lastVisit || b.date > e.lastVisit) e.lastVisit = b.date
  }
  for (const s of raw.sales) {
    const e = entry(s.customerId)
    e.productsPurchased += s.qty ?? 0
    e.totalSpent += s.amount
  }
  for (const b of raw.bonuses) {
    if (byId.has(b.customerId)) byId.get(b.customerId)!.bonusGiven += b.points
  }
  return [...byId.values()].sort((a, b) => b.visits - a.visits || b.totalSpent - a.totalSpent)
}

export async function dashboard(args: { stylistId: string; barberId?: string; status: StylistDashboard['status']; shopStatus: StylistDashboard['shopStatus'] }): Promise<StylistDashboard> {
  const { stylistId, barberId } = args
  const today = shopNow().date
  const [raw, upcoming, pendingSales, bonusThisMonth, settings] = await Promise.all([
    loadRaw(stylistId, barberId),
    barberId
      ? serverClient.fetch<StylistDashboard['upcoming']>(
          `*[_type == "booking" && barber._ref == $barberId && status in ["pending", "confirmed", "in_progress"] && bookingDate >= $today] | order(bookingDate asc, startTime asc)[0...10]{
            _id, bookingDate, startTime, status, totalAmount, "customerName": customer->fullName, style
          }`,
          { barberId, today },
        )
      : Promise.resolve([]),
    serverClient.fetch<StylistSale[]>(
      `*[_type == "order" && seller._ref == $stylistId && status in ["pending", "paid"]] | order(createdAt desc)[0...20]{
        _id, orderNumber, status, paymentMethod, totalAmount, createdAt, shippingAddress,
        "customerName": customer->fullName, "items": items[]{ productName, quantity, priceAtOrder }
      }`,
      { stylistId },
    ),
    bonusGivenThisMonth(stylistId),
    marketplaceSettings(),
  ])

  const customers = new Set([...raw.completed.map((b) => b.customerId), ...raw.sales.map((s) => s.customerId)])
  return {
    status: args.status,
    shopStatus: args.shopStatus,
    totals: {
      customers: customers.size,
      visits: raw.completed.length,
      productsSold: raw.sales.reduce((n, s) => n + (s.qty ?? 0), 0),
      revenueBookings: raw.completed.reduce((n, b) => n + b.amount, 0),
      revenueProducts: raw.sales.reduce((n, s) => n + s.amount, 0),
      pendingSales: pendingSales.length,
      upcomingBookings: upcoming.length,
      bonusPointsThisMonth: bonusThisMonth,
      bonusMonthlyCap: settings.bonusMonthlyCap,
    },
    upcoming,
    pendingSales,
  }
}
