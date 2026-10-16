import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'
import { renderServer, text } from '../helpers/render'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) }),
  usePathname: () => '/dashboard',
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/app/(auth)/login/actions', () => ({ login: vi.fn(), logout: vi.fn() }))
vi.mock('@/lib/server/adminAuth', () => ({ requireAdmin: vi.fn(async () => ({ id: 'a1', email: 'a@cutty.app', name: 'A', role: 'owner' })) }))
vi.mock('@/app/(dashboard)/actions', () => ({ advanceOrderStatus: vi.fn() }))
vi.mock('@/app/(dashboard)/stylists/actions', () => ({ reviewStylist: vi.fn(), setSuspended: vi.fn(), reviewShop: vi.fn() }))

// Each dashboard page is an async server component: await it, render to HTML.
async function page(load: () => Promise<{ default: () => Promise<React.ReactElement> | React.ReactElement }>) {
  const Page = (await load()).default
  return text(renderServer(await Page()))
}

const { requireAdmin } = await import('@/lib/server/adminAuth')

beforeEach(() => {
  sanity.reset()
})

describe('every dashboard page re-checks the admin session in the database', () => {
  it.each(['dashboard', 'bookings', 'orders', 'customers', 'loyalty', 'payments', 'products', 'stylists'])(
    '%s refuses a revoked session before reading any data',
    async (name) => {
      vi.mocked(requireAdmin).mockRejectedValueOnce(Object.assign(new Error('NEXT_REDIRECT'), { url: '/login' }))
      const { default: Page } = await import(`@/app/(dashboard)/${name}/page.tsx`)
      await expect(Page()).rejects.toMatchObject({ url: '/login' })
      expect(sanity.client.fetch).not.toHaveBeenCalled()
    },
  )
})

describe('layouts and entry pages', () => {
  it('root page redirects to the dashboard', async () => {
    const { default: RootPage } = await import('@/app/page')
    expect(() => RootPage()).toThrow(expect.objectContaining({ url: '/dashboard' }))
  })

  it('root layout sets metadata and wraps children', async () => {
    const { default: RootLayout, metadata } = await import('@/app/layout')
    expect(metadata.title).toBe('Cutty Admin')
    expect(renderServer(<RootLayout><p>child</p></RootLayout>)).toMatch(/<html lang="en"><body[^>]*><p>child<\/p><\/body><\/html>/)
  })

  it('dashboard layout renders the sidebar and is always dynamic', async () => {
    const mod = await import('@/app/(dashboard)/layout')
    expect(mod.dynamic).toBe('force-dynamic')
    const html = renderServer(<mod.default><p>content</p></mod.default>)
    expect(html).toContain('Admin Panel')
    expect(html).toContain('<main')
    expect(html).toContain('<p>content</p>')
  })

  it('login page renders the email, password and authenticator fields', async () => {
    const { default: Login } = await import('@/app/(auth)/login/page')
    const html = renderServer(<Login />)
    for (const name of ['email', 'password', 'code']) expect(html).toContain(`name="${name}"`)
    expect(html).toContain('autoComplete="one-time-code"')
  })
})

describe('dashboard pages', () => {
  it('dashboard shows revenue, counts and recent activity', async () => {
    sanity.on('*[_type == "booking"] | order(_createdAt desc)', [{ _id: 'b1', bookingDate: '2026-06-15', startTime: '10:00', status: 'pending', totalAmount: 500_000, customer: { fullName: 'Ada' }, barber: { name: 'Tunde' } }])
    sanity.on('*[_type == "order"] | order(createdAt desc)', [{ _id: 'o1', orderNumber: 'CUT-1', status: 'paid', totalAmount: 250_000, createdAt: '2026-06-15T10:00:00Z', customer: { fullName: 'Bola' } }])
    sanity.on('count(*[_type == "customer"])', 42)
    sanity.on('"totalRevenue"', { totalRevenue: 1_000_000, bookingRevenue: 500_000, pendingBookings: 1, todayBookings: 2, orderCount: 120 })
    const t = await page(() => import('@/app/(dashboard)/dashboard/page'))
    expect(t).toContain('Total Revenue ₦10,000')
    expect(t).toContain('Booking Revenue ₦5,000')
    expect(t).toContain('Total Customers 42')
    expect(t).toContain("Today's Bookings 2")
    expect(t).toContain('Total Orders 120') // counted in the database, not from the 8 rows shown
    expect(sanity.client.fetch.mock.calls.filter(([q]) => /\[0\.\.\.8\]/.test(q))).toHaveLength(2)
    expect(t).toContain('Ada')
    expect(t).toContain('#CUT-1')
  })

  it('dashboard copes with an empty shop', async () => {
    sanity.on('_type == "booking"', [])
    sanity.on('_type == "order"', [])
    sanity.on('count(*[_type == "customer"])', 0)
    sanity.on('"totalRevenue"', {})
    expect(await page(() => import('@/app/(dashboard)/dashboard/page'))).toContain('Total Revenue ₦0')
  })

  it('bookings page counts by status and lists bookings', async () => {
    sanity.on('_type == "booking"', [
      { _id: 'b1', bookingDate: '2026-06-15', startTime: '10:00', status: 'pending', totalAmount: 100, customer: { fullName: 'Ada' }, barber: { name: 'T' }, style: 'taper-fade' },
      { _id: 'b2', bookingDate: '2026-06-14', startTime: '11:00', status: 'completed', totalAmount: 200, customer: { fullName: 'Bola' }, barber: { name: 'T' } },
    ])
    const t = await page(() => import('@/app/(dashboard)/bookings/page'))
    expect(t).toContain('2 total appointments')
    expect(t).toMatch(/2 Total 1 Pending 0 Confirmed 1 Completed/)
    expect(t).toContain('Taper Fade')
    // Read-only: stylists accept and manage bookings in the Cutty Pro app.
    expect(t).toContain('Stylists accept and manage their bookings in the Cutty Pro app')
    for (const label of ['Start', 'No Show', 'Actions']) expect(t).not.toContain(label)
    expect(t).not.toMatch(/Confirm(?!ed)|Cancel(?!led)/)
  })

  it('orders page sums revenue from paid-and-later orders only', async () => {
    sanity.on('_type == "order"', [
      { _id: 'o1', orderNumber: 'A', status: 'paid', totalAmount: 100_000, createdAt: '2026-06-01T00:00:00Z', items: [] },
      { _id: 'o2', orderNumber: 'B', status: 'pending', totalAmount: 999_900, createdAt: '2026-06-01T00:00:00Z', items: [] },
      { _id: 'o3', orderNumber: 'C', status: 'delivered', totalAmount: 50_000, createdAt: '2026-06-01T00:00:00Z', items: [] },
    ])
    expect(await page(() => import('@/app/(dashboard)/orders/page'))).toContain('3 total orders · Revenue: ₦1,500')
  })

  it('customers page counts tiers', async () => {
    sanity.on('_type == "customer"', [
      { _id: 'c1', fullName: 'Ada', email: 'a@x', tier: 'gold', loyaltyPoints: 1200, walletBalance: 0, totalVisits: 20, isActive: true, createdAt: '2026-01-01' },
      { _id: 'c2', fullName: 'Bola', email: 'b@x', tier: 'bronze', loyaltyPoints: 0, walletBalance: 0, totalVisits: 0, isActive: false, createdAt: '2026-01-01' },
    ])
    const t = await page(() => import('@/app/(dashboard)/customers/page'))
    expect(t).toContain('2 registered customers')
    expect(t).toContain('1,200')
  })

  it('loyalty page totals issued and redeemed points', async () => {
    sanity.on('_type == "loyaltyTransaction"', [
      { _id: 't1', type: 'earn', points: 300, balanceAfter: 300, createdAt: '2026-06-01T00:00:00Z', source: 'booking', customer: { fullName: 'Ada' } },
      { _id: 't2', type: 'redeem', points: -100, balanceAfter: 200, createdAt: '2026-06-02T00:00:00Z', source: 'redemption', customer: { fullName: 'Ada' } },
    ])
    sanity.on('_type == "discountCode"', [{ _id: 'd1', code: 'TEN', type: 'percentage', value: 10, isActive: true, usedCount: 0 }])
    sanity.on('_type == "customer"', [{ _id: 'c1', fullName: 'Ada', loyaltyPoints: 200, tier: 'bronze', totalVisits: 1, isActive: true }])
    const t = await page(() => import('@/app/(dashboard)/loyalty/page'))
    expect(t).toContain('300')
    expect(t).toContain('100')
    expect(t).toContain('TEN')
  })

  it('payments page shows wallet totals and transactions', async () => {
    sanity.on('_type == "walletTransaction"', [{ _id: 'w1', type: 'credit', category: 'topup', amount: 500_000, balanceAfter: 500_000, status: 'completed', createdAt: '2026-06-01T00:00:00Z', customer: { fullName: 'Ada', email: 'a@x' } }])
    sanity.on('math::sum(*[_type == "customer"]', 500_000)
    sanity.on('math::sum(*[_type == "order"', 0)
    sanity.on('math::sum(*[_type == "booking"', 0)
    const t = await page(() => import('@/app/(dashboard)/payments/page'))
    expect(t).toContain('₦5,000')
    expect(t).toContain('Ada')
  })

  it('products page flags low and out-of-stock items', async () => {
    sanity.on('_type == "product"', [
      { _id: 'p1', name: 'Gel', price: 100_000, stock: 0, isActive: true, pointsEarned: 10 },
      { _id: 'p2', name: 'Comb', price: 50_000, stock: 3, isActive: false, pointsEarned: 5 },
    ])
    const t = await page(() => import('@/app/(dashboard)/products/page'))
    expect(t).toContain('2 products')
    expect(t).toContain('Gel')
  })

  it('cutty pro page groups stylists by review state', async () => {
    const base = { fullName: 'X', email: 'x@x', kind: 'barber', windows: 0, products: 0, skills: [], styles: [] }
    sanity.on('_type == "stylist"', [
      { ...base, _id: 's1', fullName: 'Pending Pat', status: 'pending' },
      { ...base, _id: 's2', fullName: 'Shop Sam', status: 'approved', shop: { status: 'requested', name: 'Sam Shop', accountNumber: '0123456789' } },
      { ...base, _id: 's3', fullName: 'Approved Ada', status: 'approved', bookingPrice: 500_000, bookingDuration: 90 },
      { ...base, _id: 's4', fullName: 'Suspended Sue', status: 'suspended' },
    ])
    const t = await page(() => import('@/app/(dashboard)/stylists/page'))
    expect(t).toContain('₦5,000 / 90 min')
    expect(t).toContain('no price set')
    expect(t).toMatch(/Waiting for review \(1\)[\s\S]*Pending Pat[\s\S]*Shop requests \(1\)[\s\S]*Shop Sam[\s\S]*Approved \(1\)[\s\S]*Approved Ada[\s\S]*Rejected or suspended \(1\)[\s\S]*Suspended Sue/)
    expect(t).not.toContain('0123456789')
  })

  it.each([
    ['bookings', 'No bookings'],
    ['orders', 'No orders yet'],
    ['customers', 'No customers yet'],
    ['products', 'No products yet'],
    ['stylists', 'No stylists have signed up yet'],
  ])('%s page shows an empty state', async (name, message) => {
    sanity.on(() => true, [])
    expect(await page(() => import(`@/app/(dashboard)/${name}/page.tsx`))).toContain(message)
  })
})
