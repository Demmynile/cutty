import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverClient, now } from './sanity'
import { HttpError } from './http'
import { mutateCustomer } from './ledger'
import { audit } from './audit'

const API = 'https://api.paystack.co'

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new HttpError(503, 'Card payments are not available right now.')
  return key
}

export type PaymentKind = 'topup' | 'order'

export async function initializePayment(args: {
  email: string
  amount: number // kobo
  reference: string
  kind: PaymentKind
  callbackUrl: string
  /** Stylist's Paystack subaccount: Paystack splits the charge, Cutty keeps the subaccount's percentage_charge. */
  subaccount?: string
}): Promise<string> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      amount: args.amount,
      currency: 'NGN',
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: { kind: args.kind },
      // Paystack's fees come out of the stylist's share, not Cutty's commission.
      ...(args.subaccount ? { subaccount: args.subaccount, bearer: 'subaccount' } : {}),
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status) {
    console.error('[paystack] initialize failed', res.status, json?.message)
    throw new HttpError(502, 'Could not start the payment. Please try again.')
  }
  return json.data.authorization_url as string
}

async function paystackGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${secretKey()}` }, cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status) {
    console.error('[paystack] GET failed', path.split('?')[0], res.status, json?.message)
    throw new HttpError(502, json?.message && res.status === 422 ? json.message : 'Paystack is not responding. Please try again.')
  }
  return json.data as T
}

let bankCache: { at: number; banks: Array<{ code: string; name: string }> } | null = null

export async function listBanks() {
  if (bankCache && Date.now() - bankCache.at < 24 * 60 * 60 * 1000) return bankCache.banks
  const data = await paystackGet<Array<{ name: string; code: string; active: boolean }>>('/bank?country=nigeria&currency=NGN&perPage=200')
  const banks = data.filter((b) => b.active).map((b) => ({ code: b.code, name: b.name })).sort((a, b) => a.name.localeCompare(b.name))
  bankCache = { at: Date.now(), banks }
  return banks
}

/** Looks up the account holder's name so the stylist can confirm it before submitting. */
export async function resolveAccount(accountNumber: string, bankCode: string) {
  const data = await paystackGet<{ account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  )
  return data.account_name
}

/** Creates the stylist's split-payment subaccount. Cutty keeps `commissionPercent` of every sale. */
export async function createSubaccount(args: { businessName: string; bankCode: string; accountNumber: string; commissionPercent: number; email: string }) {
  const res = await fetch(`${API}/subaccount`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: args.businessName,
      settlement_bank: args.bankCode,
      account_number: args.accountNumber,
      percentage_charge: args.commissionPercent,
      primary_contact_email: args.email,
    }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status) {
    console.error('[paystack] subaccount failed', res.status, json?.message)
    throw new HttpError(502, json?.message ? `Paystack: ${json.message}` : 'Could not create the Paystack subaccount.')
  }
  return json.data.subaccount_code as string
}

type VerifiedTx = { status: string; amount: number; reference: string; currency: string }

async function verifyWithPaystack(reference: string): Promise<VerifiedTx> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status) throw new HttpError(502, 'Could not confirm the payment yet. Please try again.')
  return json.data as VerifiedTx
}

export function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function callbackUrl(req: Request) {
  const origin = process.env.APP_PUBLIC_URL || new URL(req.url).origin
  return `${origin}/api/v1/payments/return`
}

type PendingTopup = { _id: string; _rev: string; amount: number; status: string; customerId: string }
type PendingOrder = {
  _id: string; _rev: string; totalAmount: number; status: string; customerId: string
  orderNumber: string; pointsEarned: number
}

export type SettleResult = { status: 'completed' | 'pending' | 'failed'; kind: PaymentKind }

// Idempotent: called from the app after checkout returns AND from the Paystack
// webhook. Money only moves when Paystack itself reports success for the full
// amount, and the conditional patch on the pending record means a reference
// can never be credited twice.
export async function settlePayment(reference: string, expectedCustomerId?: string): Promise<SettleResult> {
  const topup = await serverClient.fetch<PendingTopup | null>(
    `*[_type == "walletTransaction" && paymentReference == $reference && category == "topup"][0]{ _id, _rev, amount, status, "customerId": customer._ref }`,
    { reference },
  )
  const order = topup
    ? null
    : await serverClient.fetch<PendingOrder | null>(
        `*[_type == "order" && paymentReference == $reference][0]{ _id, _rev, totalAmount, status, orderNumber, "pointsEarned": coalesce(pointsEarned, 0), "customerId": customer._ref }`,
        { reference },
      )

  const record = topup ?? order
  if (!record) throw new HttpError(404, 'Payment not found')
  if (expectedCustomerId && record.customerId !== expectedCustomerId) throw new HttpError(404, 'Payment not found')
  const kind: PaymentKind = topup ? 'topup' : 'order'

  const alreadyDone = topup ? topup.status === 'completed' : order!.status !== 'pending'
  if (alreadyDone) return { status: 'completed', kind }

  const verified = await verifyWithPaystack(reference)
  const expectedAmount = topup ? topup.amount : order!.totalAmount

  if (verified.status !== 'success') {
    if (verified.status === 'failed' || verified.status === 'abandoned') {
      if (topup) await serverClient.patch(topup._id).ifRevisionId(topup._rev).set({ status: 'failed' }).commit().catch(() => {})
      return { status: 'failed', kind }
    }
    return { status: 'pending', kind }
  }

  if (verified.amount !== expectedAmount || verified.currency !== 'NGN') {
    await audit({
      action: 'payment.amount_mismatch',
      actor: { type: 'system', id: 'paystack' },
      target: { type: kind, id: record._id },
      outcome: 'failure',
      details: { reference, expectedAmount, paidAmount: verified.amount, currency: verified.currency },
    })
    throw new HttpError(409, 'Payment amount did not match. Our team has been notified.')
  }

  try {
    if (topup) {
      await mutateCustomer(topup.customerId, (c) => ({
        set: { walletBalance: c.walletBalance + topup.amount },
        patch: [{ id: topup._id, rev: topup._rev, set: { status: 'completed', balanceAfter: c.walletBalance + topup.amount } }],
        result: null,
      }))
    } else {
      const o = order!
      await mutateCustomer(o.customerId, (c) => ({
        set: { loyaltyPoints: c.loyaltyPoints + o.pointsEarned },
        patch: [{ id: o._id, rev: o._rev, set: { status: 'paid', paidAt: now() } }],
        create: o.pointsEarned > 0 ? [{
          _type: 'loyaltyTransaction',
          customer: { _type: 'reference', _ref: o.customerId },
          type: 'earn', points: o.pointsEarned, balanceAfter: c.loyaltyPoints + o.pointsEarned,
          description: `Points from Order #${o.orderNumber}`, source: 'order',
          referenceId: o._id, createdAt: now(),
        }] : [],
        result: null,
      }))
    }
  } catch (err) {
    // A concurrent settle (webhook vs app) may have flipped the record first,
    // which makes our conditional patch conflict. Re-read before giving up.
    const current = await serverClient.fetch<string | null>(`*[_id == $id][0].status`, { id: record._id })
    if (current === 'completed' || current === 'paid') return { status: 'completed', kind }
    throw err
  }

  await audit({
    action: kind === 'topup' ? 'wallet.topup' : 'order.paid',
    actor: { type: 'system', id: 'paystack' },
    target: { type: kind === 'topup' ? 'walletTransaction' : 'order', id: record._id },
    details: { reference, amount: expectedAmount, customerId: record.customerId },
  })
  return { status: 'completed', kind }
}
