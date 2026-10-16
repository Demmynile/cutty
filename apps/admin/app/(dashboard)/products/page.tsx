import { sanityClient, formatPrice } from '@/lib/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import type { Product } from '@cutty/types'

async function getProducts() {
  return sanityClient.fetch(`*[_type == "product"] | order(_createdAt desc){
    _id, name, price, compareAtPrice, stock, sku, isFeatured, isActive, pointsEarned,
    category->{ name }
  }`)
}

export default async function ProductsPage() {
  await requireAdmin() // re-checks the admin in the database on every request
  const products: Product[] = await getProducts()
  const activeCount = products.filter((p) => p.isActive).length
  const lowStock = products.filter((p) => p.stock <= 5 && p.stock > 0).length
  const outOfStock = products.filter((p) => p.stock === 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-3xl font-bold">Products</h1>
        <p className="text-gray-400 mt-1">{products.length} products · Manage in Sanity Studio</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: products.length, color: 'text-white' },
          { label: 'Active', value: activeCount, color: 'text-green-400' },
          { label: 'Low Stock (≤5)', value: lowStock, color: 'text-yellow-400' },
          { label: 'Out of Stock', value: outOfStock, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-400 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-gray-800">
              {['Product', 'Category', 'Price', 'Stock', 'SKU', 'Points', 'Featured', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{p.name}</p>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">{(p as any).category?.name || '—'}</td>
                <td className="px-4 py-3">
                  <p className="text-primary-400 font-bold text-sm">{formatPrice(p.price)}</p>
                  {p.compareAtPrice && <p className="text-gray-500 text-xs line-through">{formatPrice(p.compareAtPrice)}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold text-sm ${p.stock === 0 ? 'text-red-400' : p.stock <= 5 ? 'text-yellow-400' : 'text-white'}`}>
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.sku || '—'}</td>
                <td className="px-4 py-3 text-yellow-400 text-sm">+{p.pointsEarned}</td>
                <td className="px-4 py-3">
                  {p.isFeatured ? <span className="text-primary-400 text-sm">⭐ Yes</span> : <span className="text-gray-500 text-sm">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {products.length === 0 && <div className="text-center py-16 text-gray-400">No products yet. Add them in Sanity Studio.</div>}
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {products.map((p) => (
          <div key={p._id} className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-medium">{p.name}</p>
                <p className="text-gray-400 text-xs">{(p as any).category?.name || '—'}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${p.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {p.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Price</p>
                <p className="text-primary-400 font-bold">{formatPrice(p.price)}</p>
                {p.compareAtPrice && <p className="text-gray-500 text-xs line-through">{formatPrice(p.compareAtPrice)}</p>}
              </div>
              <div>
                <p className="text-gray-500 text-xs">Stock</p>
                <span className={`font-bold ${p.stock === 0 ? 'text-red-400' : p.stock <= 5 ? 'text-yellow-400' : 'text-white'}`}>
                  {p.stock}
                </span>
              </div>
              <div>
                <p className="text-gray-500 text-xs">SKU</p>
                <p className="text-gray-400 text-xs font-mono">{p.sku || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Points</p>
                <p className="text-yellow-400">+{p.pointsEarned}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Featured</p>
                {p.isFeatured ? <span className="text-primary-400">⭐ Yes</span> : <span className="text-gray-500">—</span>}
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && <div className="text-center py-16 text-gray-400 bg-gray-900 rounded-2xl">No products yet. Add them in Sanity Studio.</div>}
      </div>
    </div>
  )
}
