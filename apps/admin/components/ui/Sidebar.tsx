'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FEATURES } from '@cutty/types'
import { logout } from '@/app/(auth)/login/actions'

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/bookings', icon: '📅', label: 'Bookings' },
  { href: '/stylists', icon: '💈', label: 'Stylists' },
  ...(FEATURES.shop ? [
    { href: '/products', icon: '🛍️', label: 'Products' },
    { href: '/orders', icon: '📦', label: 'Orders' },
  ] : []),
  { href: '/customers', icon: '👥', label: 'Customers' },
  { href: '/loyalty', icon: '⭐', label: 'Loyalty' },
  { href: '/payments', icon: '💰', label: 'Payments' },
]

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'linear-gradient(135deg, #f4bc4f, #d4891a, #7e290a)',
          boxShadow: '0 4px 12px rgba(212, 137, 26, 0.4)',
        }}
      >
        <div className="w-[34px] h-[34px] rounded-full bg-gray-900 flex items-center justify-center">
          <span className="text-primary-400 text-base font-thin tracking-wide">O</span>
        </div>
      </div>
      <div>
        <h1 className="text-white font-bold text-lg leading-none">CUTTY</h1>
        <p className="text-gray-400 text-xs mt-0.5">Admin Panel</p>
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 z-30">
        <Logo />
        <button
          onClick={() => setOpen(true)}
          className="text-gray-300 hover:text-white p-2 -mr-2"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / mobile drawer */}
      <aside
        className={`w-72 lg:w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1"
            aria-label="Close menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
