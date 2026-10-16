import { sanityClient, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import type { Customer } from '@cutty/types'
import { TIER_COLORS } from './tierColors'

async function getCustomers() {
  return sanityClient.fetch(`*[_type == "customer"] | order(createdAt desc){
    _id, fullName, email, phone, tier, walletBalance, loyaltyPoints, totalVisits, isActive, createdAt
  }`)
}

export default async function CustomersPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const customers: Customer[] = await getCustomers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-3xl font-bold">Customers</h1>
        <p className="text-gray-400 mt-1">{customers.length} registered customers</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Bronze', tier: 'bronze', count: customers.filter((c) => c.tier === 'bronze').length },
          { label: 'Silver', tier: 'silver', count: customers.filter((c) => c.tier === 'silver').length },
          { label: 'Gold', tier: 'gold', count: customers.filter((c) => c.tier === 'gold').length },
          { label: 'Platinum', tier: 'platinum', count: customers.filter((c) => c.tier === 'platinum').length },
        ].map(({ label, tier, count }) => (
          <div key={tier} className="bg-gray-900 rounded-xl p-4 text-center" style={{ borderLeft: `4px solid ${TIER_COLORS[tier]}` }}>
            <p className="text-2xl font-bold" style={{ color: TIER_COLORS[tier] }}>{count}</p>
            <p className="text-gray-400 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Customer', 'Contact', 'Tier', 'Wallet', 'Points', 'Visits', 'Status', 'Joined'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                      {c.fullName?.charAt(0)?.toUpperCase()}
                    </div>
                    <p className="text-white text-sm font-medium">{c.fullName}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{c.email}</p>
                  <p className="text-gray-400 text-xs">{c.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                    {c.tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-white text-sm">{formatPrice(c.walletBalance)}</td>
                <td className="px-4 py-3 text-white text-sm">{c.loyaltyPoints?.toLocaleString()}</td>
                <td className="px-4 py-3 text-white text-sm">{c.totalVisits}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {customers.length === 0 && <div className="text-center py-16 text-gray-400">No customers yet</div>}
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {customers.map((c) => (
          <div key={c._id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                  {c.fullName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{c.fullName}</p>
                  <p className="text-gray-400 text-xs">{c.phone}</p>
                </div>
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize shrink-0" style={{ backgroundColor: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                {c.tier}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Email</p>
              <p className="text-white text-sm">{c.email}</p>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Wallet</p>
                <p className="text-white">{formatPrice(c.walletBalance)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Points</p>
                <p className="text-white">{c.loyaltyPoints?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Visits</p>
                <p className="text-white">{c.totalVisits}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-800">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {c.isActive ? 'Active' : 'Inactive'}
              </span>
              <p className="text-gray-400 text-xs">Joined {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</p>
            </div>
          </div>
        ))}
        {customers.length === 0 && <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">No customers yet</div>}
      </div>
    </div>
  )
}
