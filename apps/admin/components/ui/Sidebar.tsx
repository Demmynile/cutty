'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/bookings', icon: '📅', label: 'Bookings' },
  { href: '/services', icon: '✂', label: 'Services' },
  { href: '/barbers', icon: '👤', label: 'Barbers' },
  { href: '/products', icon: '🛍️', label: 'Products' },
  { href: '/orders', icon: '📦', label: 'Orders' },
  { href: '/customers', icon: '👥', label: 'Customers' },
  { href: '/loyalty', icon: '⭐', label: 'Loyalty' },
  { href: '/payments', icon: '💰', label: 'Payments' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    localStorage.removeItem('cutty_admin_auth')
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col fixed left-0 top-0 bottom-0">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-xl">✂</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">CUTTY</h1>
            <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? 'bg-primary-500/20 text-primary-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}
