// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { click, render, renderServer, text } from '../helpers/render'

const nav = vi.hoisted(() => ({ pathname: '/dashboard', refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: nav.refresh }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, className }: { href: string; children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.() }} className={className}>{children}</a>
  ),
}))
vi.mock('@/app/(auth)/login/actions', () => ({ logout: vi.fn() }))
vi.mock('@/app/(dashboard)/actions', () => ({ advanceOrderStatus: vi.fn() }))
vi.mock('@/app/(dashboard)/stylists/actions', () => ({ reviewStylist: vi.fn(), setSuspended: vi.fn(), reviewShop: vi.fn() }))

const { Badge, bookingStatusColor, orderStatusColor } = await import('@/components/ui/Badge')
const { StatCard } = await import('@/components/ui/StatCard')
const { Sidebar } = await import('@/components/ui/Sidebar')
const { TIER_COLORS } = await import('@/app/(dashboard)/customers/tierColors')
const { OrderStatusAction } = await import('@/app/(dashboard)/orders/OrderStatusAction')
const { StylistActions } = await import('@/app/(dashboard)/stylists/StylistActions')
const { logout } = await import('@/app/(auth)/login/actions')
const { advanceOrderStatus } = await import('@/app/(dashboard)/actions')
const { reviewStylist, setSuspended, reviewShop } = await import('@/app/(dashboard)/stylists/actions')

beforeEach(() => {
  document.body.innerHTML = ''
  nav.pathname = '/dashboard'
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('prompt', vi.fn(() => 'A note'))
})

describe('Badge', () => {
  it('humanises the label and applies the colour', () => {
    const html = renderServer(<Badge label="in_progress" color="purple" />)
    expect(text(html)).toBe('in progress')
    expect(html).toContain('bg-purple-500/20')
    expect(renderServer(<Badge label="x" />)).toContain('bg-gray-500/20')
  })

  it.each([
    ['pending', 'yellow'], ['confirmed', 'blue'], ['in_progress', 'purple'], ['completed', 'green'], ['cancelled', 'red'], ['no_show', 'gray'], ['weird', 'gray'],
  ])('booking %s → %s', (status, color) => {
    expect(bookingStatusColor(status)).toBe(color)
  })

  it.each([
    ['pending', 'yellow'], ['paid', 'blue'], ['processing', 'purple'], ['shipped', 'cyan'], ['delivered', 'green'], ['cancelled', 'red'], ['refunded', 'gray'], ['weird', 'gray'],
  ])('order %s → %s', (status, color) => {
    expect(orderStatusColor(status)).toBe(color)
  })
})

describe('StatCard', () => {
  it('renders title, value, sub and an up trend', () => {
    const html = renderServer(<StatCard title="Revenue" value="₦1,000" sub="Today" icon="💰" trend={{ value: 12, label: 'vs last week' }} color="green" />)
    expect(text(html)).toBe('Revenue ₦1,000 Today ↑ 12% vs last week 💰')
    expect(html).toContain('text-green-400')
  })

  it('shows a down trend in red and falls back to the primary colour', () => {
    const html = renderServer(<StatCard title="T" value={3} icon="x" trend={{ value: -4, label: 'drop' }} color="nope" />)
    expect(text(html)).toContain('↓ 4% drop')
    expect(html).toContain('text-red-400')
    expect(html).toContain('bg-primary-500/10')
  })
})

describe('TIER_COLORS', () => {
  it('has a colour for every tier', () => {
    expect(Object.keys(TIER_COLORS)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })
})

describe('Sidebar', () => {
  it('lists every dashboard section and highlights the current one', async () => {
    nav.pathname = '/orders'
    const { container } = await render(<Sidebar />)
    const links = [...container.querySelectorAll('nav a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/bookings', '/stylists', '/products', '/orders', '/customers', '/loyalty', '/payments'])
    const active = links.filter((a) => a.className.includes('bg-primary-500/20'))
    expect(active.map((a) => a.getAttribute('href'))).toEqual(['/orders'])
  })

  it('opens and closes the mobile drawer', async () => {
    const { container } = await render(<Sidebar />)
    const aside = () => container.querySelector('aside')!
    expect(aside().className).toContain('-translate-x-full')
    await click(container.querySelector('[aria-label="Open menu"]')!)
    expect(aside().className).toContain(' translate-x-0')
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    await click(container.querySelector('nav a')!)
    expect(aside().className).toContain('-translate-x-full')
  })

  it('signs out', async () => {
    const r = await render(<Sidebar />)
    await click(r.button('🚪 Sign Out'))
    expect(logout).toHaveBeenCalled()
  })
})

describe('OrderStatusAction', () => {
  it.each([['pending', 'Mark Paid'], ['paid', 'Processing'], ['processing', 'Mark Shipped'], ['shipped', 'Mark Delivered']] as const)(
    '%s → "%s"',
    async (status, label) => {
      expect((await render(<OrderStatusAction orderId="o1" currentStatus={status} />)).buttons()).toEqual([label])
    },
  )

  it('shows a dash when there is no next status', async () => {
    expect((await render(<OrderStatusAction orderId="o1" currentStatus="delivered" />)).container.textContent).toBe('—')
  })

  it('advances the order and alerts errors', async () => {
    vi.mocked(advanceOrderStatus).mockResolvedValue({ ok: false, error: 'Only an owner can mark an order as paid' })
    const r = await render(<OrderStatusAction orderId="o1" currentStatus="pending" />)
    await click(r.button('Mark Paid'))
    expect(advanceOrderStatus).toHaveBeenCalledWith('o1')
    expect(alert).toHaveBeenCalledWith('Only an owner can mark an order as paid')
    expect(nav.refresh).toHaveBeenCalled()
  })
})

describe('StylistActions', () => {
  beforeEach(() => {
    for (const fn of [reviewStylist, setSuspended, reviewShop]) vi.mocked(fn).mockResolvedValue({ ok: true })
  })

  it.each([
    ['pending', 'none', ['Approve profile', 'Reject']],
    ['rejected', 'none', ['Approve profile']],
    ['approved', 'requested', ['Suspend', 'Approve shop', 'Reject shop']],
    ['approved', 'approved', ['Suspend', 'Suspend shop']],
    ['suspended', 'suspended', ['Reinstate', 'Reopen shop']],
  ])('status %s / shop %s shows %j', async (status, shopStatus, labels) => {
    expect((await render(<StylistActions stylistId="s1" status={status} shopStatus={shopStatus} />)).buttons()).toEqual(labels)
  })

  it('approves and rejects profiles, passing the prompted note', async () => {
    const r = await render(<StylistActions stylistId="s1" status="pending" shopStatus="none" />)
    await click(r.button('Approve profile'))
    expect(reviewStylist).toHaveBeenLastCalledWith('s1', 'approve')
    await click(r.button('Reject'))
    expect(reviewStylist).toHaveBeenLastCalledWith('s1', 'reject', 'A note')
  })

  it('asks for confirmation before suspending, and does nothing if declined', async () => {
    vi.mocked(confirm).mockReturnValueOnce(false)
    const r = await render(<StylistActions stylistId="s1" status="approved" shopStatus="approved" />)
    await click(r.button('Suspend'))
    expect(setSuspended).not.toHaveBeenCalled()
    await click(r.button('Suspend'))
    expect(setSuspended).toHaveBeenCalledWith('s1', true)
    await click(r.button('Suspend shop'))
    expect(reviewShop).toHaveBeenCalledWith('s1', 'suspend', 'A note')
  })

  it('handles shop approval, rejection and reopening, alerting failures', async () => {
    const r = await render(<StylistActions stylistId="s1" status="approved" shopStatus="requested" />)
    vi.mocked(reviewShop).mockResolvedValueOnce({ ok: false, error: 'Shop has no bank account' })
    await click(r.button('Approve shop'))
    expect(alert).toHaveBeenCalledWith('Shop has no bank account')
    await click(r.button('Reject shop'))
    expect(reviewShop).toHaveBeenLastCalledWith('s1', 'reject', 'A note')

    const s = await render(<StylistActions stylistId="s1" status="suspended" shopStatus="suspended" />)
    await click(s.button('Reinstate'))
    expect(setSuspended).toHaveBeenLastCalledWith('s1', false)
    await click(s.button('Reopen shop'))
    expect(reviewShop).toHaveBeenLastCalledWith('s1', 'approve')
  })
})
