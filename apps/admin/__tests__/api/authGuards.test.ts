import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'
import { params, request } from '../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/customerAuth', async (orig) => ({ ...(await orig<object>()), requireCustomer: vi.fn() }))
vi.mock('@/lib/server/stylistAuth', async (orig) => ({ ...(await orig<object>()), requireStylist: vi.fn() }))
vi.mock('@/lib/server/clerk', async (orig) => ({ ...(await orig<object>()), requireClerkUser: vi.fn() }))

const { HttpError } = await import('@/lib/server/http')
const { requireCustomer } = await import('@/lib/server/customerAuth')
const { requireStylist } = await import('@/lib/server/stylistAuth')
const { requireClerkUser } = await import('@/lib/server/clerk')

type Handler = (req: Request, ctx: unknown) => Promise<Response>
const ctx = params({ id: 'x', resource: ['x'] })

// Every customer- and stylist-only endpoint. If a new route forgets its auth
// call, add it here and this suite fails.
const customerRoutes: Array<[string, string, () => Promise<Record<string, unknown>>]> = [
  ['GET', 'bookings', () => import('@/app/api/v1/bookings/route')],
  ['POST', 'bookings', () => import('@/app/api/v1/bookings/route')],
  ['GET', 'bookings/[id]', () => import('@/app/api/v1/bookings/[id]/route')],
  ['POST', 'bookings/[id]/cancel', () => import('@/app/api/v1/bookings/[id]/cancel/route')],
  ['GET', 'conversations', () => import('@/app/api/v1/conversations/route')],
  ['POST', 'conversations', () => import('@/app/api/v1/conversations/route')],
  ['GET', 'conversations/[id]/messages', () => import('@/app/api/v1/conversations/[id]/messages/route')],
  ['POST', 'conversations/[id]/ask-ai', () => import('@/app/api/v1/conversations/[id]/ask-ai/route')],
  ['POST', 'discounts/validate', () => import('@/app/api/v1/discounts/validate/route')],
  ['POST', 'loyalty/redeem', () => import('@/app/api/v1/loyalty/redeem/route')],
  ['GET', 'loyalty/transactions', () => import('@/app/api/v1/loyalty/transactions/route')],
  ['GET', 'me', () => import('@/app/api/v1/me/route')],
  ['PATCH', 'me', () => import('@/app/api/v1/me/route')],
  ['DELETE', 'me', () => import('@/app/api/v1/me/route')],
  ['PUT', 'me/payment-methods', () => import('@/app/api/v1/me/payment-methods/route')],
  ['GET', 'orders', () => import('@/app/api/v1/orders/route')],
  ['POST', 'orders', () => import('@/app/api/v1/orders/route')],
  ['POST', 'payments/verify', () => import('@/app/api/v1/payments/verify/route')],
  ['GET', 'recommendations', () => import('@/app/api/v1/recommendations/route')],
  ['POST', 'wallet/topup', () => import('@/app/api/v1/wallet/topup/route')],
  ['GET', 'wallet/transactions', () => import('@/app/api/v1/wallet/transactions/route')],
  ['POST', 'wallet/withdraw', () => import('@/app/api/v1/wallet/withdraw/route')],
  ['POST', 'ai/search', () => import('@/app/api/ai/search/route')],
]

const stylistRoutes: Array<[string, string, () => Promise<Record<string, unknown>>, object | undefined]> = [
  ['PUT', 'pro/availability', () => import('@/app/api/v1/pro/availability/route'), undefined],
  ['GET', 'pro/banks', () => import('@/app/api/v1/pro/banks/route'), undefined],
  ['POST', 'pro/banks', () => import('@/app/api/v1/pro/banks/route'), undefined],
  ['GET', 'pro/bookings', () => import('@/app/api/v1/pro/bookings/route'), { approved: true }],
  ['POST', 'pro/bookings/[id]/status', () => import('@/app/api/v1/pro/bookings/[id]/status/route'), { approved: true }],
  ['GET', 'pro/conversations', () => import('@/app/api/v1/pro/conversations/route'), { approved: true }],
  ['GET', 'pro/conversations/[id]/messages', () => import('@/app/api/v1/pro/conversations/[id]/messages/route'), { approved: true }],
  ['POST', 'pro/conversations/[id]/suggest', () => import('@/app/api/v1/pro/conversations/[id]/suggest/route'), { approved: true }],
  ['GET', 'pro/customers', () => import('@/app/api/v1/pro/customers/route'), { approved: true }],
  ['POST', 'pro/customers/[id]/bonus', () => import('@/app/api/v1/pro/customers/[id]/bonus/route'), { approved: true }],
  ['GET', 'pro/dashboard', () => import('@/app/api/v1/pro/dashboard/route'), undefined],
  ['GET', 'pro/me', () => import('@/app/api/v1/pro/me/route'), undefined],
  ['PATCH', 'pro/me', () => import('@/app/api/v1/pro/me/route'), undefined],
  ['GET', 'pro/products', () => import('@/app/api/v1/pro/products/route'), { shop: true }],
  ['POST', 'pro/products', () => import('@/app/api/v1/pro/products/route'), { shop: true }],
  ['PATCH', 'pro/products/[id]', () => import('@/app/api/v1/pro/products/[id]/route'), { shop: true }],
  ['DELETE', 'pro/products/[id]', () => import('@/app/api/v1/pro/products/[id]/route'), { shop: true }],
  ['GET', 'pro/sales', () => import('@/app/api/v1/pro/sales/route'), { shop: true }],
  ['POST', 'pro/sales/[id]', () => import('@/app/api/v1/pro/sales/[id]/route'), { shop: true }],
  ['POST', 'pro/shop', () => import('@/app/api/v1/pro/shop/route'), undefined],
  ['POST', 'pro/uploads', () => import('@/app/api/v1/pro/uploads/route'), undefined],
]

const clerkRoutes: Array<[string, string, () => Promise<Record<string, unknown>>]> = [
  ['POST', 'auth/session', () => import('@/app/api/v1/auth/session/route')],
  ['POST', 'pro/auth/session', () => import('@/app/api/v1/pro/auth/session/route')],
  ['POST', 'pro/auth/register', () => import('@/app/api/v1/pro/auth/register/route')],
]

beforeEach(() => {
  sanity.reset()
  const unauth = new HttpError(401, 'Please sign in')
  vi.mocked(requireCustomer).mockRejectedValue(unauth)
  vi.mocked(requireStylist).mockRejectedValue(unauth)
  vi.mocked(requireClerkUser).mockRejectedValue(unauth)
})

describe('customer routes require a signed-in customer', () => {
  it.each(customerRoutes)('%s /api/v1/%s → 401', async (method, _path, load) => {
    const handler = (await load())[method] as Handler
    const res = await handler(request(method, '/x', method === 'GET' ? undefined : {}), ctx)
    expect(res.status).toBe(401)
    expect(sanity.client.fetch).not.toHaveBeenCalled()
    expect(sanity.writes).toEqual([])
  })
})

describe('Cutty Pro routes require a stylist with the right approval', () => {
  it.each(stylistRoutes)('%s /api/v1/%s → 401', async (method, _path, load, opts) => {
    const handler = (await load())[method] as Handler
    const res = await handler(request(method, '/x', method === 'GET' ? undefined : {}), ctx)
    expect(res.status).toBe(401)
    expect(requireStylist).toHaveBeenCalledWith(expect.any(Request), ...(opts ? [opts] : []))
    expect(sanity.writes).toEqual([])
  })
})

describe('sign-in routes require a Clerk token', () => {
  it.each(clerkRoutes)('%s /api/v1/%s → 401', async (method, _path, load) => {
    const handler = (await load())[method] as Handler
    const res = await handler(request(method, '/x', method === 'GET' ? undefined : {}), ctx)
    expect(res.status).toBe(401)
    expect(sanity.writes).toEqual([])
  })
})
