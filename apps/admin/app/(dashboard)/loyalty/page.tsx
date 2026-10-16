import { sanityClient, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import type { LoyaltyTransaction, DiscountCode } from '@cutty/types'

async function getLoyaltyData() {
  const [transactions, codes, topCustomers] = await Promise.all([
    sanityClient.fetch(`*[_type == "loyaltyTransaction"] | order(createdAt desc)[0..49]{
      _id, type, points, balanceAfter, description, source, createdAt,
      customer->{ fullName, email, loyaltyPoints, tier }
    }`),
    sanityClient.fetch(`*[_type == "discountCode"] | order(_createdAt desc){
      _id, code, type, value, applicableTo, pointsCost, usedCount, maxUses, isActive, validUntil,
      customer->{ fullName }
    }`),
    sanityClient.fetch(`*[_type == "customer"] | order(loyaltyPoints desc)[0..9]{
      _id, fullName, loyaltyPoints, tier, totalVisits
    }`),
  ])
  return { transactions, codes, topCustomers }
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2',
}

export default async function LoyaltyPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const { transactions, codes, topCustomers } = await getLoyaltyData()

  const totalPointsIssued = (transactions as LoyaltyTransaction[]).filter((t) => t.points > 0).reduce((s, t) => s + t.points, 0)
  const totalPointsRedeemed = (transactions as LoyaltyTransaction[]).filter((t) => t.points < 0).reduce((s, t) => s + Math.abs(t.points), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-3xl font-bold">Loyalty Program</h1>
        <p className="text-gray-400 mt-1">Manage points, tiers, and discount codes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total Points Issued</p>
          <p className="text-white text-2xl font-bold mt-1">{totalPointsIssued.toLocaleString()}</p>
          <p className="text-primary-400 text-xs mt-1">≈ {formatPrice(totalPointsIssued * 50)} value</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total Points Redeemed</p>
          <p className="text-white text-2xl font-bold mt-1">{totalPointsRedeemed.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Active Discount Codes</p>
          <p className="text-white text-2xl font-bold mt-1">{(codes as DiscountCode[]).filter((c) => c.isActive).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4">Top Loyalty Customers</h2>
          <div className="space-y-3">
            {topCustomers.map((c: any, i: number) => (
              <div key={c._id} className="flex items-center gap-4">
                <span className="text-gray-400 text-sm w-5">{i + 1}</span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: TIER_COLORS[c.tier] + '33', color: TIER_COLORS[c.tier] }}>
                  {c.fullName?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{c.fullName}</p>
                  <p className="text-gray-400 text-xs capitalize">{c.tier} · {c.totalVisits} visits</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-400 font-bold text-sm">{c.loyaltyPoints.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Discount Codes */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4">Discount Codes</h2>
          <div className="space-y-3">
            {(codes as DiscountCode[]).slice(0, 10).map((code) => (
              <div key={code._id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <code className="text-primary-400 font-mono text-sm">{code.code}</code>
                  <p className="text-gray-400 text-xs">
                    {code.type === 'percentage' ? `${code.value}% off` : `₦${(code.value / 100).toLocaleString()} off`}
                    {code.customer && ` · ${(code.customer as any).fullName}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-300 text-xs">{code.usedCount}/{code.maxUses || '∞'} uses</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${code.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {code.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Points Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Customer', 'Type', 'Points', 'Balance After', 'Source', 'Description', 'Date'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(transactions as LoyaltyTransaction[]).map((tx) => (
              <tr key={tx._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{(tx as any).customer?.fullName}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${tx.type === 'earn' || tx.type === 'bonus' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold text-sm ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </span>
                </td>
                <td className="px-4 py-3 text-white text-sm">{tx.balanceAfter?.toLocaleString()} pts</td>
                <td className="px-4 py-3 text-gray-400 text-xs capitalize">{tx.source}</td>
                <td className="px-4 py-3 text-gray-300 text-sm">{tx.description}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {(transactions as LoyaltyTransaction[]).length === 0 && <div className="text-center py-16 text-gray-400">No loyalty transactions yet</div>}
      </div>

      {/* Transaction History (mobile) */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden md:hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Points Transaction History</h2>
        </div>
        <div className="p-4 space-y-3">
          {(transactions as LoyaltyTransaction[]).map((tx) => (
            <div key={tx._id} className="bg-gray-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-white text-sm">{(tx as any).customer?.fullName}</p>
                <span className={`font-bold text-sm shrink-0 ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.points > 0 ? '+' : ''}{tx.points}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${tx.type === 'earn' || tx.type === 'bonus' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tx.type}
                </span>
                <span className="text-gray-400 text-xs capitalize">{tx.source}</span>
              </div>
              {tx.description && <p className="text-gray-300 text-sm">{tx.description}</p>}
              <div className="flex items-center justify-between pt-1 text-xs">
                <p className="text-white">{tx.balanceAfter?.toLocaleString()} pts balance</p>
                <p className="text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {(transactions as LoyaltyTransaction[]).length === 0 && <div className="text-center py-16 text-gray-400">No loyalty transactions yet</div>}
        </div>
      </div>
    </div>
  )
}
