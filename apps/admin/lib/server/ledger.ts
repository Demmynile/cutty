import 'server-only'
import { randomUUID } from 'node:crypto'
import type { LoyaltyTier } from '@cutty/types'
import { serverClient } from './sanity'
import { HttpError } from './http'

export type CustomerBalances = {
  _id: string
  _rev: string
  email: string
  walletBalance: number
  loyaltyPoints: number
  totalVisits: number
  tier: LoyaltyTier
}

type Plan<T> = {
  set?: Partial<Omit<CustomerBalances, '_id' | '_rev' | 'email'>>
  create?: Array<Record<string, unknown> & { _type: string }>
  // Other documents to patch in the same transaction. `rev` makes the patch
  // conditional, e.g. single-use discount codes or pending payments.
  patch?: Array<{ id: string; rev?: string; set: Record<string, unknown> }>
  result: T
}

const BALANCES = `*[_type == "customer" && _id == $id && isActive != false][0]{
  _id, _rev, email, "walletBalance": coalesce(walletBalance, 0), "loyaltyPoints": coalesce(loyaltyPoints, 0),
  "totalVisits": coalesce(totalVisits, 0), "tier": coalesce(tier, "bronze")
}`

function isConflict(err: unknown) {
  const status = (err as { statusCode?: number })?.statusCode
  return status === 409
}

// All balance-changing operations (wallet, loyalty points, visits) go through
// here. The customer patch is conditional on the revision we read, so two
// concurrent requests can't both spend the same balance — the loser retries
// against fresh numbers (and fails cleanly if the funds are gone).
export async function mutateCustomer<T>(customerId: string, build: (c: CustomerBalances) => Plan<T> | Promise<Plan<T>>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const customer = await serverClient.fetch<CustomerBalances | null>(BALANCES, { id: customerId })
    if (!customer) throw new HttpError(404, 'Account not found')

    const plan = await build(customer)
    const tx = serverClient.transaction()
    tx.patch(customer._id, (p) => p.ifRevisionId(customer._rev).set(plan.set ?? {}))
    for (const doc of plan.create ?? []) tx.create({ _id: newId(), ...doc })
    for (const p of plan.patch ?? []) tx.patch(p.id, (q) => (p.rev ? q.ifRevisionId(p.rev) : q).set(p.set))

    try {
      await tx.commit()
      return plan.result
    } catch (err) {
      if (isConflict(err)) continue
      throw err
    }
  }
  throw new HttpError(409, 'Your account was updated at the same time. Please try again.')
}

export function newId() {
  return randomUUID()
}

/** Stable document id for a Clerk user's account, e.g. customer-user_2abc. */
export function accountId(kind: 'customer' | 'stylist', clerkUserId: string) {
  return `${kind}-${clerkUserId.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

const TIER_VISITS: Array<[LoyaltyTier, number]> = [
  ['platinum', 30],
  ['gold', 15],
  ['silver', 5],
  ['bronze', 0],
]

export function tierForVisits(visits: number): LoyaltyTier {
  return TIER_VISITS.find(([, min]) => visits >= min)![0]
}

export function orderNumber() {
  return `CUT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`
}
