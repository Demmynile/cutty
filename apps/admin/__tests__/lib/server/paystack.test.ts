import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conflict, sanity } from '../../helpers/sanity'
import { request } from '../../helpers/http'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))

const paystack = await import('@/lib/server/paystack')
const { audit } = await import('@/lib/server/audit')

const ok = (data: unknown) => new Response(JSON.stringify({ status: true, data }), { status: 200 })
const fail = (status: number, message?: string) => new Response(JSON.stringify({ status: false, message }), { status })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sanity.reset()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('initializePayment', () => {
  it('starts an NGN charge and returns the checkout URL', async () => {
    fetchMock.mockResolvedValue(ok({ authorization_url: 'https://checkout.paystack.com/x' }))
    const url = await paystack.initializePayment({ email: 'a@b.c', amount: 50_000, reference: 'ref', kind: 'topup', callbackUrl: 'https://cb' })
    expect(url).toBe('https://checkout.paystack.com/x')
    const [endpoint, init] = fetchMock.mock.calls[0]
    expect(endpoint).toBe('https://api.paystack.co/transaction/initialize')
    expect(init.headers.Authorization).toBe('Bearer sk_test_paystack')
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c', amount: 50_000, currency: 'NGN', reference: 'ref', callback_url: 'https://cb', metadata: { kind: 'topup' } })
  })

  it('routes the split to a stylist subaccount that bears the fees', async () => {
    fetchMock.mockResolvedValue(ok({ authorization_url: 'u' }))
    await paystack.initializePayment({ email: 'a@b.c', amount: 1, reference: 'r', kind: 'order', callbackUrl: 'c', subaccount: 'ACCT_1' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ subaccount: 'ACCT_1', bearer: 'subaccount' })
  })

  it('502s when Paystack refuses', async () => {
    fetchMock.mockResolvedValue(fail(400, 'bad'))
    await expect(paystack.initializePayment({ email: 'a', amount: 1, reference: 'r', kind: 'order', callbackUrl: 'c' })).rejects.toMatchObject({ status: 502 })
  })

  it('503s when card payments are not configured', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '')
    await expect(paystack.initializePayment({ email: 'a', amount: 1, reference: 'r', kind: 'order', callbackUrl: 'c' })).rejects.toMatchObject({ status: 503 })
  })
})

describe('banks', () => {
  it('lists active banks sorted by name and caches them for a day', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    fetchMock.mockImplementation(async () => ok([
      { name: 'Zenith', code: '057', active: true },
      { name: 'Access', code: '044', active: true },
      { name: 'Dead Bank', code: '000', active: false },
    ]))
    expect(await paystack.listBanks()).toEqual([{ code: '044', name: 'Access' }, { code: '057', name: 'Zenith' }])
    await paystack.listBanks()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)
    await paystack.listBanks()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("resolves an account holder's name", async () => {
    fetchMock.mockResolvedValue(ok({ account_name: 'ADA OBI' }))
    expect(await paystack.resolveAccount('0123456789', '058')).toBe('ADA OBI')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.paystack.co/bank/resolve?account_number=0123456789&bank_code=058')
  })

  it("surfaces Paystack's message for a 422 (e.g. wrong account number) and hides others", async () => {
    fetchMock.mockResolvedValueOnce(fail(422, 'Could not resolve account name'))
    await expect(paystack.resolveAccount('1', '2')).rejects.toMatchObject({ status: 502, message: 'Could not resolve account name' })
    fetchMock.mockResolvedValueOnce(fail(500, 'internal detail'))
    await expect(paystack.resolveAccount('1', '2')).rejects.toMatchObject({ message: expect.stringMatching(/not responding/) })
  })
})

describe('createSubaccount', () => {
  it('creates the split account with Cutty’s commission', async () => {
    fetchMock.mockResolvedValue(ok({ subaccount_code: 'ACCT_9' }))
    await expect(paystack.createSubaccount({ businessName: 'Shop', bankCode: '058', accountNumber: '0123456789', commissionPercent: 10, email: 's@x' })).resolves.toBe('ACCT_9')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      business_name: 'Shop', settlement_bank: '058', account_number: '0123456789', percentage_charge: 10, primary_contact_email: 's@x',
    })
  })

  it('prefixes Paystack errors', async () => {
    fetchMock.mockResolvedValue(fail(400, 'Invalid bank'))
    await expect(paystack.createSubaccount({ businessName: 'S', bankCode: '1', accountNumber: '1', commissionPercent: 1, email: 'e' }))
      .rejects.toMatchObject({ status: 502, message: 'Paystack: Invalid bank' })
  })
})

describe('isValidWebhookSignature', () => {
  const body = '{"event":"charge.success"}'
  const sig = createHmac('sha512', 'sk_test_paystack').update(body).digest('hex')

  it('accepts the HMAC-SHA512 of the raw body', () => {
    expect(paystack.isValidWebhookSignature(body, sig)).toBe(true)
  })

  it('rejects missing, wrong-length and tampered signatures', () => {
    expect(paystack.isValidWebhookSignature(body, null)).toBe(false)
    expect(paystack.isValidWebhookSignature(body, 'abc')).toBe(false)
    expect(paystack.isValidWebhookSignature(`${body} `, sig)).toBe(false)
  })
})

describe('callbackUrl', () => {
  it('prefers APP_PUBLIC_URL, else the request origin', () => {
    expect(paystack.callbackUrl(request('GET', '/x'))).toBe('http://localhost/api/v1/payments/return')
    vi.stubEnv('APP_PUBLIC_URL', 'https://api.cutty.app')
    expect(paystack.callbackUrl(request('GET', '/x'))).toBe('https://api.cutty.app/api/v1/payments/return')
  })
})

describe('settlePayment', () => {
  const TOPUP_Q = 'category == "topup"'
  const ORDER_Q = '_type == "order" && paymentReference'
  const CUSTOMER_Q = '_type == "customer"'
  const customer = { _id: 'c1', _rev: 'cr', email: 'c@x', walletBalance: 1000, loyaltyPoints: 5, totalVisits: 0, tier: 'bronze' }
  const topup = { _id: 'w1', _rev: 'wr', amount: 50_000, status: 'pending', customerId: 'c1' }
  const order = { _id: 'o1', _rev: 'or', totalAmount: 30_000, status: 'pending', customerId: 'c1', orderNumber: 'CUT-1', pointsEarned: 3 }
  const verified = (data: object) => fetchMock.mockImplementation(async () => ok({ status: 'success', amount: 50_000, currency: 'NGN', reference: 'r', ...data }))

  it('404s for an unknown reference or another customer’s payment', async () => {
    await expect(paystack.settlePayment('r')).rejects.toMatchObject({ status: 404 })
    sanity.on(TOPUP_Q, topup)
    await expect(paystack.settlePayment('r', 'c2')).rejects.toMatchObject({ status: 404 })
  })

  it('is idempotent: an already-settled payment is reported without calling Paystack', async () => {
    sanity.on(TOPUP_Q, { ...topup, status: 'completed' })
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'completed', kind: 'topup' })
    sanity.reset()
    sanity.on(ORDER_Q, { ...order, status: 'paid' })
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'completed', kind: 'order' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('credits the wallet for a verified top-up and audits it', async () => {
    sanity.on(TOPUP_Q, topup)
    sanity.on(CUSTOMER_Q, customer)
    verified({})
    await expect(paystack.settlePayment('r', 'c1')).resolves.toEqual({ status: 'completed', kind: 'topup' })
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.patches[0]).toMatchObject({ id: 'c1', set: { walletBalance: 51_000 } })
    expect(tx.patches[1]).toMatchObject({ id: 'w1', ifRevisionId: 'wr', set: { status: 'completed', balanceAfter: 51_000 } })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'wallet.topup' }))
  })

  it('marks a verified order paid and credits its points', async () => {
    sanity.on(ORDER_Q, order)
    sanity.on(CUSTOMER_Q, customer)
    verified({ amount: 30_000 })
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'completed', kind: 'order' })
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.patches[0].set).toEqual({ loyaltyPoints: 8 })
    expect(tx.patches[1]).toMatchObject({ id: 'o1', ifRevisionId: 'or', set: { status: 'paid' } })
    expect(tx.creates[0]).toMatchObject({ _type: 'loyaltyTransaction', points: 3 })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.paid' }))
  })

  it('refuses to credit a short or non-NGN payment and flags it', async () => {
    sanity.on(TOPUP_Q, topup)
    verified({ amount: 100 })
    await expect(paystack.settlePayment('r')).rejects.toMatchObject({ status: 409 })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment.amount_mismatch', outcome: 'failure' }))

    verified({ currency: 'USD' })
    await expect(paystack.settlePayment('r')).rejects.toMatchObject({ status: 409 })
    expect(sanity.writes).toEqual([])
  })

  it('marks a failed/abandoned top-up failed, and leaves other statuses pending', async () => {
    sanity.on(TOPUP_Q, topup)
    verified({ status: 'abandoned' })
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'failed', kind: 'topup' })
    expect(sanity.patches()[0]).toMatchObject({ id: 'w1', set: { status: 'failed' } })

    verified({ status: 'ongoing' })
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'pending', kind: 'topup' })
  })

  it('treats a lost race with the webhook as success', async () => {
    sanity.on(TOPUP_Q, topup)
    sanity.on(CUSTOMER_Q, customer)
    sanity.on('*[_id == $id][0].status', 'completed')
    verified({})
    sanity.failNextCommit(new Error('revision mismatch'))
    await expect(paystack.settlePayment('r')).resolves.toEqual({ status: 'completed', kind: 'topup' })
  })

  it('rethrows when the record still is not settled after a failed write', async () => {
    sanity.on(TOPUP_Q, topup)
    sanity.on(CUSTOMER_Q, customer)
    sanity.on('*[_id == $id][0].status', 'pending')
    verified({})
    sanity.failNextCommit(new Error('boom'))
    await expect(paystack.settlePayment('r')).rejects.toThrow('boom')
  })

  it('502s when Paystack cannot verify yet', async () => {
    sanity.on(TOPUP_Q, topup)
    fetchMock.mockResolvedValue(fail(500))
    await expect(paystack.settlePayment('r')).rejects.toMatchObject({ status: 502 })
  })

  it('retries ledger conflicts internally before succeeding', async () => {
    sanity.on(TOPUP_Q, topup)
    sanity.on(CUSTOMER_Q, customer)
    verified({})
    sanity.failNextCommit(conflict())
    await expect(paystack.settlePayment('r')).resolves.toMatchObject({ status: 'completed' })
  })
})
