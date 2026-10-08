import { sanityClient, formatPrice } from '@/lib/sanity'
import type { WalletTransaction } from '@cutty/types'

async function getPaymentsData() {
  const [walletTxns, totalWalletBalance, orderRevenue, bookingRevenue] = await Promise.all([
    sanityClient.fetch(`*[_type == "walletTransaction"] | order(createdAt desc)[0..49]{
      _id, type, category, amount, balanceAfter, description, status, createdAt, paymentReference,
      customer->{ fullName, email }
    }`),
    sanityClient.fetch(`math::sum(*[_type == "customer"].walletBalance)`),
    sanityClient.fetch(`math::sum(*[_type == "order" && status in ["paid","processing","shipped","delivered"]].totalAmount)`),
    sanityClient.fetch(`math::sum(*[_type == "booking" && status == "completed"].totalAmount)`),
  ])
  return { walletTxns, totalWalletBalance, orderRevenue, bookingRevenue }
}

export default async function PaymentsPage() {
  const { walletTxns, totalWalletBalance, orderRevenue, bookingRevenue } = await getPaymentsData()

  const totalTopups = (walletTxns as WalletTransaction[]).filter((t) => t.category === 'topup').reduce((s, t) => s + t.amount, 0)

  const stats = [
    { label: 'Total Order Revenue', value: formatPrice(orderRevenue || 0), icon: '📦', color: 'text-blue-400' },
    { label: 'Total Booking Revenue', value: formatPrice(bookingRevenue || 0), icon: '✂', color: 'text-purple-400' },
    { label: 'Wallet Funds Held', value: formatPrice(totalWalletBalance || 0), icon: '👛', color: 'text-primary-400' },
    { label: 'Total Wallet Top-ups', value: formatPrice(totalTopups), icon: '💳', color: 'text-green-400' },
  ]

  const categoryColor: Record<string, string> = {
    topup: 'text-green-400', booking_payment: 'text-blue-400', order_payment: 'text-purple-400',
    refund: 'text-yellow-400', withdrawal: 'text-red-400', admin_adjust: 'text-gray-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-3xl font-bold">Payments & Wallet</h1>
        <p className="text-gray-400 mt-1">Financial overview and wallet transactions</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-gray-900 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">{label}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl">{icon}</span>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Wallet Transactions</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Customer', 'Type', 'Category', 'Amount', 'Balance After', 'Reference', 'Status', 'Date'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(walletTxns as WalletTransaction[]).map((tx) => (
              <tr key={tx._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{(tx as any).customer?.fullName}</p>
                  <p className="text-gray-400 text-xs">{(tx as any).customer?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium text-sm ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'credit' ? '↓ Credit' : '↑ Debit'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm capitalize ${categoryColor[tx.category || ''] || 'text-gray-400'}`}>
                    {tx.category?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold text-sm ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white text-sm">{formatPrice(tx.balanceAfter)}</td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{tx.paymentReference || tx.description || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {(walletTxns as WalletTransaction[]).length === 0 && <div className="text-center py-16 text-gray-400">No transactions yet</div>}
      </div>

      {/* Cards (mobile) */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden md:hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Wallet Transactions</h2>
        </div>
        <div className="p-4 space-y-3">
          {(walletTxns as WalletTransaction[]).map((tx) => (
            <div key={tx._id} className="bg-gray-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white text-sm">{(tx as any).customer?.fullName}</p>
                  <p className="text-gray-400 text-xs">{(tx as any).customer?.email}</p>
                </div>
                <span className={`font-bold text-sm shrink-0 ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-medium ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'credit' ? '↓ Credit' : '↑ Debit'}
                </span>
                <span className="text-gray-600">·</span>
                <span className={`capitalize ${categoryColor[tx.category || ''] || 'text-gray-400'}`}>
                  {tx.category?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Balance After</p>
                  <p className="text-white">{formatPrice(tx.balanceAfter)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Reference</p>
                  <p className="text-gray-400 text-xs font-mono truncate">{tx.paymentReference || tx.description || '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {tx.status}
                </span>
                <p className="text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {(walletTxns as WalletTransaction[]).length === 0 && <div className="text-center py-16 text-gray-400">No transactions yet</div>}
        </div>
      </div>
    </div>
  )
}
