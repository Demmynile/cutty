import { sanityClient, formatPrice } from '@/lib/sanity'
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

      <div className="grid grid-cols-5 gap-4">
        {['pending', 'paid', 'processing', 'shipped', 'delivered'].map((status) => (
          <div key={status} className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{orders.filter((o) => o.status === status).length}</p>
            <Badge label={status} color={orderStatusColor(status)} />
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <table className="w-full">
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
        {orders.length === 0 && <div className="text-center py-16 text-gray-400">No orders yet</div>}
      </div>
    </div>
  )
}
