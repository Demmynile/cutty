import { sanityClient, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { Badge, orderStatusColor } from '@/components/ui/Badge'
import type { Order } from '@cutty/types'
import { OrderStatusAction } from './OrderStatusAction'

async function getOrders() {
  return sanityClient.fetch(`*[_type == "order"] | order(createdAt desc){
    _id, orderNumber, status, totalAmount, subtotal, discountAmount, paymentMethod, createdAt, pointsEarned,
    customer->{ _id, fullName, email, phone },
    items[]{ quantity, priceAtOrder, productName }
  }`)
}

export default async function OrdersPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const orders: Order[] = await getOrders()
  const totalRevenue = orders.filter((o) => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold">Orders</h1>
          <p className="text-gray-400 mt-1">{orders.length} total orders · Revenue: {formatPrice(totalRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {['pending', 'paid', 'processing', 'shipped', 'delivered'].map((status) => (
          <div key={status} className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{orders.filter((o) => o.status === status).length}</p>
            <Badge label={status} color={orderStatusColor(status)} />
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Order', 'Customer', 'Items', 'Amount', 'Payment', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">#{o.orderNumber}</p>
                  <p className="text-primary-400 text-xs">+{o.pointsEarned} pts</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{(o as any).customer?.fullName}</p>
                  <p className="text-gray-400 text-xs">{(o as any).customer?.phone}</p>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">{(o.items || []).map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{formatPrice(o.totalAmount)}</p>
                  {o.discountAmount > 0 && <p className="text-green-400 text-xs">-{formatPrice(o.discountAmount)}</p>}
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm capitalize">{o.paymentMethod}</td>
                <td className="px-4 py-3"><Badge label={o.status} color={orderStatusColor(o.status)} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3"><OrderStatusAction orderId={o._id} currentStatus={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {orders.length === 0 && <div className="text-center py-16 text-gray-400">No orders yet</div>}
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <div key={o._id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-medium">#{o.orderNumber}</p>
                <p className="text-primary-400 text-xs">+{o.pointsEarned} pts</p>
              </div>
              <Badge label={o.status} color={orderStatusColor(o.status)} />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Customer</p>
              <p className="text-white text-sm">{(o as any).customer?.fullName}</p>
              <p className="text-gray-400 text-xs">{(o as any).customer?.phone}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Items</p>
              <p className="text-gray-300 text-sm">{(o.items || []).map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Amount</p>
                <p className="text-white font-medium">{formatPrice(o.totalAmount)}</p>
                {o.discountAmount > 0 && <p className="text-green-400 text-xs">-{formatPrice(o.discountAmount)}</p>}
              </div>
              <div>
                <p className="text-gray-500 text-xs">Payment</p>
                <p className="text-white capitalize">{o.paymentMethod}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Date</p>
                <p className="text-white">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-gray-800">
              <OrderStatusAction orderId={o._id} currentStatus={o.status} />
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">No orders yet</div>}
      </div>
    </div>
  )
}
