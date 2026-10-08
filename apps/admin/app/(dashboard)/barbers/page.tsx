import { sanityClient } from '@/lib/sanity'
import type { Barber } from '@cutty/types'

async function getBarbers() {
  return sanityClient.fetch(`*[_type == "barber"] | order(name asc){
    _id, name, bio, specialties, rating, totalReviews, isAvailable, workingHours, workingDays
  }`)
}

export default async function BarbersPage() {
  const barbers: Barber[] = await getBarbers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-3xl font-bold">Stylists</h1>
        <p className="text-gray-400 mt-1">{barbers.length} stylists · Manage detailed profiles in Sanity Studio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {barbers.map((b) => (
          <div key={b._id} className="bg-gray-900 rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center text-2xl font-bold text-primary-400">
                {b.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-white font-bold">{b.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-yellow-400 text-sm">⭐ {b.rating?.toFixed(1) || 'N/A'}</span>
                  <span className="text-gray-400 text-xs">({b.totalReviews || 0} reviews)</span>
                </div>
              </div>
              <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium ${b.isAvailable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {b.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            {b.bio && <p className="text-gray-400 text-sm mb-3 line-clamp-2">{b.bio}</p>}
            {b.specialties && b.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {b.specialties.map((s) => (
                  <span key={s} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg">{s}</span>
                ))}
              </div>
            )}
            {b.workingHours && (
              <p className="text-gray-400 text-xs">
                🕒 {b.workingHours.start} – {b.workingHours.end}
                {b.workingDays && ` · ${b.workingDays.join(', ')}`}
              </p>
            )}
          </div>
        ))}
        {barbers.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">
            No stylists yet. Add them in Sanity Studio.
          </div>
        )}
      </div>
    </div>
  )
}
