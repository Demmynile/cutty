import { sanityClient, formatPrice } from '@/lib/sanity'
import type { Service } from '@cutty/types'

async function getServices() {
  return sanityClient.fetch(`*[_type == "service"] | order(_createdAt asc){
    _id, name, description, price, duration, category, pointsEarned, isActive
  }`)
}

export default async function ServicesPage() {
  const services: Service[] = await getServices()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold">Services</h1>
          <p className="text-gray-400 mt-1">{services.length} services configured</p>
        </div>
        <p className="text-gray-400 text-sm">Manage in Sanity Studio →</p>
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Service', 'Category', 'Price', 'Duration', 'Points', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{s.name}</p>
                  {s.description && <p className="text-gray-400 text-xs mt-0.5 truncate max-w-xs">{s.description}</p>}
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm capitalize">{s.category || '—'}</td>
                <td className="px-4 py-3 text-primary-400 font-bold text-sm">{formatPrice(s.price)}</td>
                <td className="px-4 py-3 text-white text-sm">{s.duration} min</td>
                <td className="px-4 py-3 text-yellow-400 text-sm">+{s.pointsEarned} pts</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {services.length === 0 && <div className="text-center py-16 text-gray-400">No services yet. Add them in Sanity Studio.</div>}
      </div>
    </div>
  )
}
