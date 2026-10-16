import { FEATURES } from '@cutty/types'
import { sanityClient, formatDate, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { Badge } from '@/components/ui/Badge'
import { StylistActions } from './StylistActions'

type Row = {
  _id: string; fullName: string; displayName?: string; email: string; phone?: string; kind: string
  status: string; reviewNote?: string; skills?: string[]; styles?: string[]; createdAt?: string
  windows: number; products: number; bookingPrice?: number; bookingDuration?: number
  shop?: { status?: string; name?: string; bankName?: string; accountName?: string; accountNumber?: string; requestedAt?: string; commissionPercent?: number }
}

const STATUS_COLOR: Record<string, 'yellow' | 'green' | 'red' | 'gray' | 'blue'> = {
  pending: 'yellow', requested: 'yellow', approved: 'green', rejected: 'red', suspended: 'gray', none: 'gray',
}

async function getStylists() {
  return sanityClient.fetch<Row[]>(`*[_type == "stylist"] | order(createdAt desc){
    _id, fullName, displayName, email, phone, kind, "status": coalesce(status, "pending"), reviewNote, skills, styles, createdAt, shop,
    bookingPrice, bookingDuration, "windows": count(weeklyAvailability),
    "products": count(*[_type == "product" && seller._ref == ^._id && isActive == true])
  }`)
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null
  return (
    <section className="space-y-3">
      <h2 className="text-white text-lg font-semibold">{title} <span className="text-gray-500 text-sm font-normal">({rows.length})</span></h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((s) => {
          // Shops are hidden while FEATURES.shop is off (planned for v2.0).
          const shopStatus = FEATURES.shop ? s.shop?.status ?? 'none' : 'none'
          return (
            <div key={s._id} className="bg-gray-900 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-white font-bold">{s.displayName || s.fullName}</h3>
                  <p className="text-gray-400 text-sm">{s.email}{s.phone ? ` · ${s.phone}` : ''}</p>
                  <p className="text-gray-500 text-xs mt-1 capitalize">{s.kind === 'both' ? 'Barber & braider' : s.kind}{s.createdAt ? ` · joined ${formatDate(s.createdAt)}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge label={s.status} color={STATUS_COLOR[s.status]} />
                  {shopStatus !== 'none' && <Badge label={`shop ${shopStatus}`} color={STATUS_COLOR[shopStatus]} />}
                </div>
              </div>
              <p className="text-gray-400 text-xs">
                {s.skills?.length ?? 0} skills · {s.styles?.length ?? 0} styles · {s.windows} availability windows · {s.bookingPrice != null ? `${formatPrice(s.bookingPrice)} / ${s.bookingDuration ?? 60} min` : 'no price set'}{FEATURES.shop ? ` · ${s.products} products` : ''}
              </p>
              {!!s.skills?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {s.skills.slice(0, 8).map((k) => <span key={k} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-lg">{k}</span>)}
                </div>
              )}
              {shopStatus !== 'none' && s.shop && (
                <div className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-300 space-y-0.5">
                  <p><span className="text-gray-500">Shop:</span> {s.shop.name}</p>
                  <p><span className="text-gray-500">Payout:</span> {s.shop.accountName} · {s.shop.bankName} · ••••{s.shop.accountNumber?.slice(-4)}</p>
                  {s.shop.commissionPercent != null && <p><span className="text-gray-500">Commission:</span> {s.shop.commissionPercent}%</p>}
                </div>
              )}
              {s.reviewNote && <p className="text-gray-500 text-xs">Note: {s.reviewNote}</p>}
              <StylistActions stylistId={s._id} status={s.status} shopStatus={shopStatus} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default async function StylistAccountsPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const rows = await getStylists()
  const by = (pred: (r: Row) => boolean) => rows.filter(pred)
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-white text-3xl font-bold">Stylists</h1>
        <p className="text-gray-400 mt-1">Cutty Pro stylists who signed up in the app. Customers find them on the map or in search; approving a profile makes them bookable once they set an appointment price{FEATURES.shop ? '; approving a shop opens split payments' : ''}.</p>
      </div>
      <Section title="Waiting for review" rows={by((r) => r.status === 'pending')} />
      {FEATURES.shop && <Section title="Shop requests" rows={by((r) => r.status === 'approved' && r.shop?.status === 'requested')} />}
      <Section title="Approved" rows={by((r) => r.status === 'approved' && (!FEATURES.shop || r.shop?.status !== 'requested'))} />
      <Section title="Rejected or suspended" rows={by((r) => r.status === 'rejected' || r.status === 'suspended')} />
      {rows.length === 0 && <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">No stylists have signed up yet.</div>}
    </div>
  )
}
