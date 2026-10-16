import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'
import { json, params, request } from '../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/customerAuth', () => ({ requireCustomer: vi.fn(), resolveCustomer: vi.fn() }))
vi.mock('@/lib/server/clerk', () => ({ requireClerkUser: vi.fn(), deleteClerkUser: vi.fn() }))
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/recommendations', () => ({ recommendationsFor: vi.fn() }))
vi.mock('@/lib/server/awayAssistant', () => ({ replyAsAway: vi.fn() }))
vi.mock('@/lib/server/chat', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/chat')>()),
  createMessage: vi.fn(async (m: { text: string; senderType: string }) => ({ _id: `m-${m.senderType}`, ...m })),
  broadcast: vi.fn(),
}))
vi.mock('ai', () => ({ generateText: vi.fn() }))

const { requireCustomer, resolveCustomer } = await import('@/lib/server/customerAuth')
const { requireClerkUser, deleteClerkUser } = await import('@/lib/server/clerk')
const { audit } = await import('@/lib/server/audit')
const { recommendationsFor } = await import('@/lib/server/recommendations')
const { replyAsAway } = await import('@/lib/server/awayAssistant')
const { createMessage, broadcast } = await import('@/lib/server/chat')
const { generateText } = await import('ai')
const session = await import('@/app/api/v1/auth/session/route')
const me = await import('@/app/api/v1/me/route')
const paymentMethods = await import('@/app/api/v1/me/payment-methods/route')
const recommendations = await import('@/app/api/v1/recommendations/route')
const conversations = await import('@/app/api/v1/conversations/route')
const messages = await import('@/app/api/v1/conversations/[id]/messages/route')
const askAi = await import('@/app/api/v1/conversations/[id]/ask-ai/route')
const awayReply = await import('@/app/api/internal/away-reply/route')

const CUSTOMER_BY_ID = '_type == "customer" && _id == $customerId'
const CONVO = { _id: 'cv1', _rev: 'r', customerId: 'c1', stylistId: 's1' }

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireCustomer).mockResolvedValue({ customerId: 'c1', email: 'c@x', clerkUserId: 'u1' })
  vi.mocked(requireClerkUser).mockResolvedValue('u1')
})

describe('POST /api/v1/auth/session', () => {
  beforeEach(() => sanity.on(CUSTOMER_BY_ID, { _id: 'c1', email: 'c@x' }))

  it('creates the customer with the sign-up profile (201) and audits registration', async () => {
    vi.mocked(resolveCustomer).mockResolvedValue({ customerId: 'c1', outcome: 'created' } as never)
    const res = await json(await session.POST(request('POST', '/', { fullName: 'Ada Obi', phone: '08012345678' }), {}))
    expect(res).toEqual({ status: 201, body: { customer: { _id: 'c1', email: 'c@x' } } })
    expect(resolveCustomer).toHaveBeenCalledWith('u1', { fullName: 'Ada Obi', phone: '08012345678' })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.register' }))
  })

  it('returns an existing customer (200) without auditing', async () => {
    vi.mocked(resolveCustomer).mockResolvedValue({ customerId: 'c1', outcome: 'existing' })
    expect((await session.POST(request('POST', '/'), {})).status).toBe(200)
    expect(audit).not.toHaveBeenCalled()
  })

  it('audits linking and ignores an invalid profile', async () => {
    vi.mocked(resolveCustomer).mockResolvedValue({ customerId: 'c1', outcome: 'linked' })
    await session.POST(request('POST', '/', { fullName: 'A', phone: 1 }), {})
    expect(resolveCustomer).toHaveBeenCalledWith('u1', {})
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.link_clerk' }))
  })
})

describe('/api/v1/me', () => {
  it('GET returns the profile', async () => {
    sanity.on(CUSTOMER_BY_ID, { _id: 'c1' })
    expect((await json(await me.GET(request('GET', '/'), {}))).body).toEqual({ _id: 'c1' })
  })

  it('PATCH updates allow-listed fields and can clear the phone', async () => {
    sanity.on(CUSTOMER_BY_ID, { _id: 'c1', fullName: 'New' })
    await me.PATCH(request('PATCH', '/', { fullName: 'New', preferredCurrency: 'USD', phone: null }), {})
    expect(sanity.patches()[0]).toMatchObject({ id: 'c1', set: { fullName: 'New', preferredCurrency: 'USD' }, unset: ['phone'] })

    sanity.reset()
    await me.PATCH(request('PATCH', '/', { phone: '08012345678' }), {})
    expect(sanity.patches()[0].set).toEqual({ phone: '08012345678' })
  })

  it.each([{ walletBalance: 1e9 }, { tier: 'platinum' }, { loyaltyPoints: 5 }, { email: 'x@y.z' }, { preferredCurrency: 'EUR' }])(
    'PATCH rejects %o',
    async (bad) => {
      expect((await me.PATCH(request('PATCH', '/', bad), {})).status).toBe(400)
      expect(sanity.writes).toEqual([])
    },
  )

  it('DELETE scrubs and deactivates the account, then deletes the Clerk user', async () => {
    expect((await me.DELETE(request('DELETE', '/', { confirm: 'DELETE' }), {})).status).toBe(200)
    expect(sanity.patches()[0]).toMatchObject({
      id: 'c1',
      set: { fullName: 'Deleted user', email: 'deleted-c1@deleted.cutty.app', isActive: false, uid: 'deleted-c1' },
      unset: expect.arrayContaining(['clerkUserId', 'phone', 'avatar', 'password', 'paymentMethods']),
    })
    expect(deleteClerkUser).toHaveBeenCalledWith('u1')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.delete' }))
  })

  it('DELETE keeps the Clerk user if it still owns a Cutty Pro account', async () => {
    sanity.on('_type == "stylist"', { _id: 's1' })
    await me.DELETE(request('DELETE', '/', { confirm: 'DELETE' }), {})
    expect(deleteClerkUser).not.toHaveBeenCalled()
  })

  it('DELETE requires explicit confirmation', async () => {
    expect((await me.DELETE(request('DELETE', '/', { confirm: 'yes' }), {})).status).toBe(400)
    expect(sanity.writes).toEqual([])
  })
})

describe('PUT /api/v1/me/payment-methods', () => {
  const card = { _key: 'k1', brand: 'visa', last4: '4242', expiryMonth: 12, expiryYear: 2030, holderName: 'Ada', isDefault: true }

  it('stores display-only card metadata', async () => {
    expect(await json(await paymentMethods.PUT(request('PUT', '/', { paymentMethods: [card] }), {}))).toEqual({ status: 200, body: { paymentMethods: [card] } })
    expect(sanity.patches()[0].set).toEqual({ paymentMethods: [card] })
  })

  it.each([
    ['a full card number', { ...card, number: '4242424242424242' }],
    ['a CVV', { ...card, cvv: '123' }],
    ['a non-4-digit last4', { ...card, last4: '42424' }],
    ['a bad month', { ...card, expiryMonth: 13 }],
  ])('rejects %s', async (_l, bad) => {
    expect((await paymentMethods.PUT(request('PUT', '/', { paymentMethods: [bad] }), {})).status).toBe(400)
    expect(sanity.writes).toEqual([])
  })
})

describe('GET /api/v1/recommendations', () => {
  it('returns recommendations for the caller', async () => {
    vi.mocked(recommendationsFor).mockResolvedValue({ personalized: false } as never)
    expect((await json(await recommendations.GET(request('GET', '/'), {}))).body).toEqual({ personalized: false })
    expect(recommendationsFor).toHaveBeenCalledWith('c1')
  })
})

describe('/api/v1/conversations', () => {
  it('GET lists the caller’s threads', async () => {
    sanity.on('customer._ref == $customerId] | order', [{ _id: 'cv1' }])
    expect((await json(await conversations.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'cv1' }])
  })

  it('POST returns an existing thread without creating one', async () => {
    sanity.on('stylist._ref == $stylistId][0]', { _id: 'cv1' })
    expect(await json(await conversations.POST(request('POST', '/', { stylistId: 's1' }), {}))).toEqual({ status: 200, body: { _id: 'cv1' } })
    expect(sanity.writes).toEqual([])
  })

  it('POST opens a thread with a deterministic id', async () => {
    sanity.once('stylist._ref == $stylistId][0]', null)
    sanity.on('count(*[_type == "stylist"', 1)
    sanity.on('stylist._ref == $stylistId][0]', { _id: 'conversation-c1-s1' })
    const res = await json(await conversations.POST(request('POST', '/', { stylistId: 's.1!' }), {}))
    expect(res.status).toBe(201)
    expect(sanity.writes[0]).toMatchObject({ type: 'createIfNotExists', doc: { _id: 'conversation-c1-s1', customerUnread: 0, stylistUnread: 0, stylist: { _ref: 's.1!' } } })
  })

  it('POST 404s for a stylist who is not approved', async () => {
    sanity.on('count(*[_type == "stylist"', 0)
    expect((await conversations.POST(request('POST', '/', { stylistId: 's1' }), {})).status).toBe(404)
  })

  const THREAD = '"messages": *[_type == "chatMessage"'

  it('GET messages loads the thread in one query and clears unread on the newest page only', async () => {
    sanity.on(THREAD, { ...CONVO, customerUnread: 2, stylistUnread: 0, messages: [{ _id: 'm1' }] })
    expect((await json(await messages.GET(request('GET', '/x'), params({ id: 'cv1' })))).body).toEqual([{ _id: 'm1' }])
    expect(sanity.client.fetch).toHaveBeenCalledTimes(1) // ownership, unread and messages together
    expect(sanity.client.fetch).toHaveBeenLastCalledWith(expect.any(String), { id: 'cv1', before: '9999' })
    await vi.waitFor(() => expect(sanity.patches()).toEqual([expect.objectContaining({ id: 'cv1', set: { customerUnread: 0 } })]))

    sanity.writes.length = 0
    await messages.GET(request('GET', '/x?before=2026-01-01'), params({ id: 'cv1' }))
    expect(sanity.patches()).toEqual([])
  })

  it('GET messages skips the unread write when nothing is unread', async () => {
    sanity.on(THREAD, { ...CONVO, customerUnread: 0, stylistUnread: 4, messages: [] })
    expect((await json(await messages.GET(request('GET', '/x'), params({ id: 'cv1' })))).body).toEqual([])
    await new Promise((r) => setTimeout(r, 0))
    expect(sanity.writes).toEqual([])
  })

  it("GET messages 404s for another customer's thread", async () => {
    sanity.on(THREAD, { ...CONVO, customerId: 'c2', customerUnread: 1, stylistUnread: 0, messages: [{ _id: 'secret' }] })
    const res = await json(await messages.GET(request('GET', '/x'), params({ id: 'cv1' })))
    expect(res).toEqual({ status: 404, body: { error: 'Conversation not found' } })
    await new Promise((r) => setTimeout(r, 0))
    expect(sanity.writes).toEqual([])
  })
})

describe('POST /api/v1/conversations/[id]/ask-ai', () => {
  beforeEach(() => {
    sanity.on('_type == "conversation" && _id == $id', CONVO)
    sanity.on('"stylist"', {
      stylist: { name: 'Ada', kind: 'braider', bookingPrice: 2_500_000, bookingDuration: 240 },
      messages: [{ senderType: 'stylist', text: 'Hi!' }, { senderType: 'customer', text: 'Hello' }],
    })
  })

  it('posts the question and the AI answer to the thread', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: ' Usually 4 hours. ' } as never)
    const res = await json(await askAi.POST(request('POST', '/', { question: 'How long do knotless take?' }), params({ id: 'cv1' })))
    expect(res.status).toBe(200)
    expect(createMessage).toHaveBeenNthCalledWith(1, { conversationId: 'cv1', senderType: 'customer', senderId: 'c1', text: '@Cutty AI How long do knotless take?' })
    expect(createMessage).toHaveBeenNthCalledWith(2, { conversationId: 'cv1', senderType: 'ai', text: 'Usually 4 hours.' })
    expect(broadcast).toHaveBeenCalledTimes(2)
    const { prompt, system } = vi.mocked(generateText).mock.calls[0][0] as { prompt: string; system: string }
    expect(prompt).toMatch(/^customer: Hello\nstylist: Hi!/) // oldest first
    expect(system).toContain('Appointment price: ₦25,000 for a 240-minute appointment')
  })

  it('502s when the model fails or returns nothing (question already posted)', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('x'))
    expect((await askAi.POST(request('POST', '/', { question: 'hello?' }), params({ id: 'cv1' }))).status).toBe(502)
    vi.mocked(generateText).mockResolvedValueOnce({ text: '' } as never)
    expect((await askAi.POST(request('POST', '/', { question: 'hello?' }), params({ id: 'cv1' }))).status).toBe(502)
    expect(createMessage).toHaveBeenCalledTimes(2)
  })

  it('400s for an empty question', async () => {
    expect((await askAi.POST(request('POST', '/', { question: ' ' }), params({ id: 'cv1' }))).status).toBe(400)
  })
})

describe('POST /api/internal/away-reply', () => {
  const call = (secret?: string, body: object = { conversationId: 'cv1' }) =>
    awayReply.POST(request('POST', '/', body, secret ? { 'x-internal-secret': secret } : {}), {})

  beforeEach(() => {
    vi.stubEnv('REALTIME_INTERNAL_SECRET', 'shared-secret')
  })

  it('runs the away assistant for the realtime server', async () => {
    vi.mocked(replyAsAway).mockResolvedValue('sent')
    expect(await json(await call('shared-secret'))).toEqual({ status: 200, body: { result: 'sent' } })
    expect(replyAsAway).toHaveBeenCalledWith('cv1')
  })

  it('401s without the exact shared secret, or when none is configured', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('shared-secreT')).status).toBe(401)
    expect((await call('short')).status).toBe(401)
    vi.stubEnv('REALTIME_INTERNAL_SECRET', '')
    expect((await call('')).status).toBe(401)
    expect(replyAsAway).not.toHaveBeenCalled()
  })

  it('400s for a bad body and 502s when the assistant throws', async () => {
    expect((await call('shared-secret', {})).status).toBe(400)
    vi.mocked(replyAsAway).mockRejectedValue(new Error('x'))
    expect((await call('shared-secret')).status).toBe(502)
  })
})
