import { sanityClient, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { Badge, bookingStatusColor } from '@/components/ui/Badge'
import { styleLabel, type Booking } from '@cutty/types'

async function getBookings() {
  return sanityClient.fetch(`*[_type == "booking"] | order(bookingDate desc, startTime desc){
    _id, bookingDate, startTime, endTime, status, totalAmount, discountAmount, paymentMethod, notes, pointsEarned,
    customer->{ _id, fullName, phone, email },
    barber->{ _id, name },
    style
  }`)
}

export default async function BookingsPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const bookings: Booking[] = await getBookings()

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold">Bookings</h1>
          <p className="text-gray-400 mt-1">{bookings.length} total appointments · Stylists accept and manage their bookings in the Cutty Pro app</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: counts.all, color: 'text-white' },
          { label: 'Pending', count: counts.pending, color: 'text-yellow-400' },
          { label: 'Confirmed', count: counts.confirmed, color: 'text-blue-400' },
          { label: 'Completed', count: counts.completed, color: 'text-green-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-gray-400 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table (md+) */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Customer', 'Date & Time', 'Stylist', 'Style', 'Amount', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{(b as any).customer?.fullName}</p>
                  <p className="text-gray-400 text-xs">{(b as any).customer?.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{b.bookingDate}</p>
                  <p className="text-gray-400 text-xs">{b.startTime}</p>
                </td>
                <td className="px-4 py-3 text-white text-sm">{(b as any).barber?.name}</td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{b.style ? styleLabel(b.style) : '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{formatPrice(b.totalAmount)}</p>
                  {b.discountAmount > 0 && <p className="text-green-400 text-xs">-{formatPrice(b.discountAmount)}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge label={b.status} color={bookingStatusColor(b.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {bookings.length === 0 && (
          <div className="text-center py-16 text-gray-400">No bookings found</div>
        )}
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {bookings.map((b) => (
          <div key={b._id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-medium">{(b as any).customer?.fullName}</p>
                <p className="text-gray-400 text-xs">{(b as any).customer?.phone}</p>
              </div>
              <Badge label={b.status} color={bookingStatusColor(b.status)} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Date & Time</p>
                <p className="text-white">{b.bookingDate} · {b.startTime}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Stylist</p>
                <p className="text-white">{(b as any).barber?.name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-xs">Style</p>
                <p className="text-white">{b.style ? styleLabel(b.style) : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Amount</p>
                <p className="text-white font-medium">{formatPrice(b.totalAmount)}</p>
                {b.discountAmount > 0 && <p className="text-green-400 text-xs">-{formatPrice(b.discountAmount)}</p>}
              </div>
            </div>
          </div>
        ))}
        {bookings.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">No bookings found</div>
        )}
      </div>
    </div>
  )
}
