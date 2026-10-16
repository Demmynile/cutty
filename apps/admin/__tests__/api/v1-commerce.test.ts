import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOYALTY_REWARDS } from '@cutty/types'
import { sanity } from '../helpers/sanity'
import { json, request } from '../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/customerAuth', () => ({ requireCustomer: vi.fn() }))
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/paystack', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/paystack')>()),
  initializePayment: vi.fn(async () => 'https://checkout.paystack.com/abc'),
  settlePayment: vi.fn(),
}))

const { requireCustomer } = await import('@/lib/server/customerAuth')
const { audit } = await import('@/lib/server/audit')
const { initializePayment, settlePayment } = await import('@/lib/server/paystack')
const orders = await import('@/app/api/v1/orders/route')
const topup = await import('@/app/api/v1/wallet/topup/route')
const withdraw = await import('@/app/api/v1/wallet/withdraw/route')
const walletTx = await import('@/app/api/v1/wallet/transactions/route')
const redeem = await import('@/app/api/v1/loyalty/redeem/route')
const loyaltyTx = await import('@/app/api/v1/loyalty/transactions/route')
const validate = await import('@/app/api/v1/discounts/validate/route')
const ret = await import('@/app/api/v1/payments/return/route')
const verify = await import('@/app/api/v1/payments/verify/route')
const webhook = await import('@/app/api/v1/payments/webhook/route')

const CUSTOMER_Q = '_type == "customer" && _id == $id'
const balances = (over: object = {}) => ({ _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 1_000_000, loyaltyPoints: 600, totalVisits: 0, tier: 'bronze', ...over })
const REF = `cutty_ord_${'a'.repeat(32)}`

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireCustomer).mockResolvedValue({ customerId: 'c1', email: 'c@x', clerkUserId: 'u1' })
})

describe('POST /api/v1/orders', () => {
  const address = { fullName: 'Ada Obi', address: '1 Admiralty Way', city: 'Lagos', state: 'Lagos', phone: '08012345678' }
  const gel = { _id: 'p1', name: 'Gel', price: 200_000, stock: 5, pointsEarned: 20 }
  const comb = { _id: 'p2', name: 'Comb', price: 50_000, pointsEarned: 5 }
  const order = (paymentMethod: string, extra: object = {}) => request('POST', '/', {
    items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 2 }, { productId: 'p1', quantity: 1 }],
    shippingAddress: address, paymentMethod, ...extra,
  })

  beforeEach(() => {
    sanity.on('_id in $ids', [gel, comb])
    sanity.on(CUSTOMER_Q, balances())
  })

  it('debits the wallet, records the payment and points, and marks the order paid', async () => {
    const res = await json(await orders.POST(order('wallet'), {}))
    expect(res).toMatchObject({ status: 201, body: { status: 'paid', orderNumber: expect.stringMatching(/^CUT-/) } })

    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.patches[0]).toMatchObject({ id: 'c1', ifRevisionId: 'cr', set: { walletBalance: 500_000, loyaltyPoints: 650 } })
    const [created, walletTxn, loyaltyTxn] = tx.creates
    expect(created).toMatchObject({
      _type: 'order', status: 'paid', subtotal: 500_000, totalAmount: 500_000, pointsEarned: 50, paymentReference: undefined,
      items: [
        { _key: 'p1', quantity: 2, priceAtOrder: 200_000, productName: 'Gel' },
        { _key: 'p2', quantity: 2, priceAtOrder: 50_000, productName: 'Comb' },
      ],
    })
    expect(walletTxn).toMatchObject({ _type: 'walletTransaction', type: 'debit', category: 'order_payment', amount: 500_000, balanceAfter: 500_000 })
    expect(loyaltyTxn).toMatchObject({ _type: 'loyaltyTransaction', points: 50, balanceAfter: 650 })
    expect(initializePayment).not.toHaveBeenCalled()
  })

  it('402s when the wallet is short', async () => {
    sanity.reset()
    sanity.on('_id in $ids', [gel, comb])
    sanity.on(CUSTOMER_Q, balances({ walletBalance: 100 }))
    expect((await json(await orders.POST(order('wallet'), {}))).status).toBe(402)
    expect(sanity.writes).toEqual([])
  })

  it('creates a pending card order and returns a Paystack checkout', async () => {
    const res = await json(await orders.POST(order('card'), {}))
    expect(res.body).toMatchObject({ status: 'pending', authorizationUrl: 'https://checkout.paystack.com/abc', reference: expect.stringMatching(/^cutty_ord_[a-f0-9]{32}$/) })
    expect(initializePayment).toHaveBeenCalledWith(expect.objectContaining({ email: 'c@x', amount: 500_000, kind: 'order', reference: res.body.reference, subaccount: undefined }))
    expect(sanity.creates()[0]).toMatchObject({ status: 'pending', paymentReference: res.body.reference })
  })

  it('applies a discount and consumes it', async () => {
    sanity.on('_type == "discountCode"', { _id: 'd1', _rev: 'dr', code: 'OFF', type: 'fixed', value: 100_000, applicableTo: 'order' })
    await orders.POST(order('card', { discountCode: 'off' }), {})
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.creates[0]).toMatchObject({ discountAmount: 100_000, totalAmount: 400_000, discountCode: { _ref: 'd1' } })
    expect(tx.patches[0]).toMatchObject({ id: 'd1', ifRevisionId: 'dr', set: { usedCount: 1 } })
  })

  it('treats a fully discounted order as paid without Paystack', async () => {
    sanity.on('_type == "discountCode"', { _id: 'd1', _rev: 'dr', code: 'FREE', type: 'percentage', value: 100, applicableTo: 'both' })
    const res = await json(await orders.POST(order('card', { discountCode: 'FREE' }), {}))
    expect(res.body.status).toBe('paid')
    expect(initializePayment).not.toHaveBeenCalled()
    expect(sanity.creates().some((d) => d._type === 'walletTransaction')).toBe(false)
  })

  it('400s for missing products, insufficient stock and mixed shops', async () => {
    sanity.reset()
    sanity.on('_id in $ids', [gel])
    expect((await json(await orders.POST(order('card'), {}))).body.error).toMatch(/no longer available/)

    sanity.reset()
    sanity.on('_id in $ids', [{ ...gel, stock: 1 }, comb])
    expect((await json(await orders.POST(order('card'), {}))).body.error).toBe('Only 1 of Gel left in stock.')

    sanity.reset()
    sanity.on('_id in $ids', [{ ...gel, sellerId: 's1' }, comb])
    expect((await json(await orders.POST(order('card'), {}))).body.error).toMatch(/different shops/)
    expect(sanity.writes).toEqual([])
  })

  describe('stylist shop orders', () => {
    beforeEach(() => {
      sanity.reset()
      sanity.on('_id in $ids', [{ ...gel, sellerId: 's1' }, { ...comb, sellerId: 's1' }])
      sanity.on('_type == "stylist"', { status: 'approved', subaccountCode: 'ACCT_s1' })
    })

    it('splits card payments to the stylist subaccount', async () => {
      await orders.POST(order('card'), {})
      expect(initializePayment).toHaveBeenCalledWith(expect.objectContaining({ subaccount: 'ACCT_s1' }))
      expect(sanity.creates()[0]).toMatchObject({ seller: { _ref: 's1' }, splitSubaccount: 'ACCT_s1' })
    })

    it('leaves bank transfers pending for the stylist to confirm', async () => {
      const res = await json(await orders.POST(order('transfer'), {}))
      expect(res.body).toMatchObject({ status: 'pending', awaitingSeller: true })
      expect(sanity.creates()[0]).toMatchObject({ paymentReference: undefined, seller: { _ref: 's1' } })
      expect(sanity.creates()[0]).not.toHaveProperty('splitSubaccount')
      expect(initializePayment).not.toHaveBeenCalled()
    })

    it('earns no Cutty points, since Cutty cannot verify a transfer to the stylist', async () => {
      await orders.POST(order('transfer'), {})
      expect(sanity.creates()[0]).toMatchObject({ pointsEarned: 0 })
    })

    it('still earns points on card orders, which Paystack verifies', async () => {
      await orders.POST(order('card'), {})
      expect(sanity.creates()[0]).toMatchObject({ pointsEarned: 50 })
    })

    it('rejects wallet payment and shops that are not approved', async () => {
      expect((await json(await orders.POST(order('wallet'), {}))).body.error).toMatch(/don't accept wallet/)
      sanity.reset()
      sanity.on('_id in $ids', [{ ...gel, sellerId: 's1' }])
      sanity.on('_type == "stylist"', { status: 'suspended', subaccountCode: 'ACCT_s1' })
      expect((await json(await orders.POST(request('POST', '/', { items: [{ productId: 'p1', quantity: 1 }], shippingAddress: address, paymentMethod: 'card' }), {}))).body.error)
        .toMatch(/not accepting orders/)
    })
  })

  it('lists the caller’s orders', async () => {
    sanity.on('_type == "order" && customer._ref == $customerId', [{ _id: 'o1' }])
    expect((await json(await orders.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'o1' }])
  })
})

describe('wallet', () => {
  it('POST topup creates a pending credit and returns the checkout', async () => {
    const res = await json(await topup.POST(request('POST', '/', { amount: 500_000 }), {}))
    expect(res).toMatchObject({ status: 201, body: { authorizationUrl: 'https://checkout.paystack.com/abc', reference: expect.stringMatching(/^cutty_top_[a-f0-9]{32}$/) } })
    expect(sanity.creates()[0]).toMatchObject({ _type: 'walletTransaction', type: 'credit', category: 'topup', amount: 500_000, status: 'pending', paymentReference: res.body.reference })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'wallet.topup_started' }))
  })

  it('POST topup enforces ₦100–₦1,000,000', async () => {
    expect((await topup.POST(request('POST', '/', { amount: 9_999 }), {})).status).toBe(400)
    expect((await topup.POST(request('POST', '/', { amount: 100_000_001 }), {})).status).toBe(400)
    expect((await topup.POST(request('POST', '/', { amount: 10_000.5 }), {})).status).toBe(400)
  })

  it('POST withdraw holds the amount and records a pending request', async () => {
    sanity.on(CUSTOMER_Q, balances())
    expect(await json(await withdraw.POST(request('POST', '/', { amount: 400_000 }), {}))).toEqual({ status: 201, body: { walletBalance: 600_000, status: 'pending' } })
    expect(sanity.creates()[0]).toMatchObject({ category: 'withdrawal', type: 'debit', status: 'pending', balanceAfter: 600_000 })
  })

  it('POST withdraw 402s on insufficient balance', async () => {
    sanity.on(CUSTOMER_Q, balances({ walletBalance: 10_000 }))
    expect((await withdraw.POST(request('POST', '/', { amount: 20_000 }), {})).status).toBe(402)
  })

  it('GET transactions lists the caller’s wallet history', async () => {
    sanity.on('_type == "walletTransaction"', [{ _id: 'w' }])
    expect((await json(await walletTx.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'w' }])
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { customerId: 'c1' })
  })
})

describe('loyalty', () => {
  const reward = LOYALTY_REWARDS[0]

  it('POST redeem spends points and issues a single-use code bound to the customer', async () => {
    sanity.on(CUSTOMER_Q, balances({ loyaltyPoints: reward.points + 7 }))
    const res = await json(await redeem.POST(request('POST', '/', { rewardId: reward.id }), {}))
    expect(res).toEqual({ status: 200, body: { code: expect.stringMatching(/^CUTTY-[0-9A-F]{10}$/), loyaltyPoints: 7 } })
    const [code, txn] = sanity.creates()
    expect(code).toMatchObject({ _type: 'discountCode', code: res.body.code, type: reward.type, value: reward.value, maxUses: 1, customer: { _ref: 'c1' }, isActive: true })
    expect(txn).toMatchObject({ _type: 'loyaltyTransaction', type: 'redeem', points: -reward.points, balanceAfter: 7 })
  })

  it('POST redeem 400s for unknown rewards or too few points', async () => {
    expect((await redeem.POST(request('POST', '/', { rewardId: 'nope' }), {})).status).toBe(400)
    sanity.on(CUSTOMER_Q, balances({ loyaltyPoints: reward.points - 1 }))
    expect((await json(await redeem.POST(request('POST', '/', { rewardId: reward.id }), {}))).body.error).toMatch(`You need ${reward.points} points`)
    expect(sanity.writes).toEqual([])
  })

  it('GET transactions lists the caller’s points history', async () => {
    sanity.on('_type == "loyaltyTransaction"', [{ _id: 'l' }])
    expect((await json(await loyaltyTx.GET(request('GET', '/'), {}))).body).toEqual([{ _id: 'l' }])
  })
})

describe('POST /api/v1/discounts/validate', () => {
  it('previews a valid code without exposing internals', async () => {
    sanity.on('_type == "discountCode"', { _id: 'd1', _rev: 'secret-rev', code: 'TEN', type: 'percentage', value: 10, applicableTo: 'both', usedCount: 3, customerId: 'c1' })
    const res = await json(await validate.POST(request('POST', '/', { code: 'ten', context: 'order', subtotal: 1000 }), {}))
    expect(res).toEqual({ status: 200, body: { _id: 'd1', code: 'TEN', type: 'percentage', value: 10, applicableTo: 'both' } })
  })

  it('400s for invalid codes and bodies', async () => {
    expect((await validate.POST(request('POST', '/', { code: 'X', context: 'order', subtotal: 1 }), {})).status).toBe(400)
    expect((await validate.POST(request('POST', '/', { code: 'X', context: 'gift', subtotal: 1 }), {})).status).toBe(400)
  })
})

describe('payments', () => {
  it('GET return bounces to the app, passing through only well-formed references', async () => {
    const res = ret.GET(request('GET', `/x?reference=${REF}`))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`cutty://payment-complete?reference=${REF}`)
    expect(ret.GET(request('GET', '/x?reference=javascript:alert(1)')).headers.get('location')).toBe('cutty://payment-complete?reference=')
  })

  it('POST verify settles for the calling customer only', async () => {
    vi.mocked(settlePayment).mockResolvedValue({ status: 'completed', kind: 'order' })
    expect(await json(await verify.POST(request('POST', '/', { reference: REF }), {}))).toEqual({ status: 200, body: { status: 'completed', kind: 'order' } })
    expect(settlePayment).toHaveBeenCalledWith(REF, 'c1')
    expect((await verify.POST(request('POST', '/', { reference: 'other' }), {})).status).toBe(400)
  })

  describe('POST webhook', () => {
    const sign = (body: string) => createHmac('sha512', 'sk_test_paystack').update(body).digest('hex')
    const hook = (body: object, signature?: string) => {
      const raw = JSON.stringify(body)
      return webhook.POST(request('POST', '/', raw, { 'x-paystack-signature': signature ?? sign(raw) }))
    }

    it('settles a signed charge.success for a Cutty reference', async () => {
      vi.mocked(settlePayment).mockResolvedValue({ status: 'completed', kind: 'order' })
      expect((await hook({ event: 'charge.success', data: { reference: REF } })).status).toBe(200)
      expect(settlePayment).toHaveBeenCalledWith(REF)
    })

    it('401s and audits a bad signature', async () => {
      expect((await hook({ event: 'charge.success', data: { reference: REF } }, 'f'.repeat(128))).status).toBe(401)
      expect(settlePayment).not.toHaveBeenCalled()
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment.webhook_rejected', outcome: 'failure' }))
    })

    it('acknowledges other events and foreign references without settling', async () => {
      expect((await hook({ event: 'transfer.success', data: { reference: REF } })).status).toBe(200)
      expect((await hook({ event: 'charge.success', data: { reference: 'someone_else' } })).status).toBe(200)
      expect(settlePayment).not.toHaveBeenCalled()
    })

    it('500s on settle failure so Paystack retries', async () => {
      vi.mocked(settlePayment).mockRejectedValue(new Error('sanity down'))
      expect((await hook({ event: 'charge.success', data: { reference: REF } })).status).toBe(500)
    })
  })
})
