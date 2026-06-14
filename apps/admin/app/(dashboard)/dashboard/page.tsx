import { sanityClient, formatPrice } from '@/lib/sanity'
import { StatCard } from '@/components/ui/StatCard'
import { Badge, bookingStatusColor, orderStatusColor } from '@/components/ui/Badge'
import type { Booking, Order } from '@cutty/types'

async function getDashboardData() {
  const [bookings, orders, customers, revenue] = await Promise.all([
    sanityClient.fetch(`*[_type == "booking"] | order(_createdAt desc)[0..49]{
      _id, bookingDate, startTime, status, totalAmount,
      customer->{ fullName }, barber->{ name }
    }`),
    sanityClient.fetch(`*[_type == "order"] | order(createdAt desc)[0..49]{
      _id, orderNumber, status, totalAmount, createdAt,
      customer->{ fullName }
    }`),
    sanityClient.fetch(`count(*[_type == "customer"])`),
    sanityClient.fetch(`{
      "totalRevenue": math::sum(*[_type == "order" && status in ["paid","processing","shipped","delivered"]].totalAmount),
      "bookingRevenue": math::sum(*[_type == "booking" && status == "completed"].totalAmount),
      "pendingBookings": count(*[_type == "booking" && status == "pending"]),
      "todayBookings": count(*[_type == "booking" && bookingDate == $today])
    }`, { today: new Date().toISOString().split('T')[0] }),
  ])
  return { bookings, orders, customers, revenue }
}

export default async function DashboardPage() {
  const { bookings, orders, customers, revenue } = await getDashboardData()

  const stats = [
    { title: 'Total Revenue', value: formatPrice(revenue.totalRevenue || 0), icon: '💰', color: 'primary' as const, sub: 'Orders + Bookings' },
    { title: 'Booking Revenue', value: formatPrice(revenue.bookingRevenue || 0), icon: '✂', color: 'purple' as const },
    { title: 'Total Customers', value: customers, icon: '👥', color: 'blue' as const },
    { title: 'Pending Bookings', value: revenue.pendingBookings || 0, icon: '📅', color: 'yellow' as const },
    { title: "Today's Bookings", value: revenue.todayBookings || 0, icon: '📋', color: 'green' as const },
    { title: 'Total Orders', value: orders.length, icon: '📦', color: 'blue' as const },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-white text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back, here's what's happening at Cutty</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-bold text-lg">Recent Bookings</h2>
            <a href="/dashboard/bookings" className="text-primary-400 text-sm hover:underline">View all →</a>
          </div>
          <div className="space-y-3">
            {(bookings as Booking[]).slice(0, 8).map((b) => (
              <div key={b._id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{(b as any).customer?.fullName}</p>
                  <p className="text-gray-400 text-xs">{b.bookingDate} · {b.startTime} · {(b as any).barber?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm">{formatPrice(b.totalAmount)}</span>
                  <Badge label={b.status} color={bookingStatusColor(b.status)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-bold text-lg">Recent Orders</h2>
            <a href="/dashboard/orders" className="text-primary-400 text-sm hover:underline">View all →</a>
          </div>
          <div className="space-y-3">
            {(orders as Order[]).slice(0, 8).map((o) => (
              <div key={o._id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">#{o.orderNumber}</p>
                  <p className="text-gray-400 text-xs">{(o as any).customer?.fullName} · {new Date(o.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm">{formatPrice(o.totalAmount)}</span>
                  <Badge label={o.status} color={orderStatusColor(o.status)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
