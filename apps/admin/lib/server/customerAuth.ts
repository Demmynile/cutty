import 'server-only'
import { serverClient, now } from './sanity'
import { HttpError } from './http'
import { requireClerkUser, clerkIdentity } from './clerk'
import { accountId } from './ledger'
import { CUSTOMER_SESSION_BY_CLERK_ID, CUSTOMER_LINKABLE_BY_EMAIL } from './queries'

export type CustomerSession = { customerId: string; email: string; clerkUserId: string }

// Every customer API route starts here. The customer is looked up from the
// verified Clerk token, never from the request, so one customer can't act as
// another. The app calls POST /api/v1/auth/session right after signing in,
// which creates or links the customer record for a new Clerk user.
export async function requireCustomer(req: Request): Promise<CustomerSession> {
  const clerkUserId = await requireClerkUser(req)
  const customer = await serverClient.fetch<{ _id: string; email: string; isActive?: boolean } | null>(
    CUSTOMER_SESSION_BY_CLERK_ID,
    { clerkUserId },
  )
  // 401 is reserved for an unverifiable token, so the app can tell a server
  // hiccup apart from an account that is really gone.
  if (!customer) throw new HttpError(404, 'We could not find your Cutty account. Please sign in again.')
  if (customer.isActive === false) throw new HttpError(403, 'This account has been deactivated. Contact Cutty support.')
  return { customerId: customer._id, email: customer.email, clerkUserId }
}

type Profile = { fullName?: string; phone?: string }

/**
 * Finds the customer for a Clerk user, creating it on first sign-in. An
 * existing (pre-Clerk) account with the same *verified* email is linked
 * instead, so members keep their wallet, points and history.
 */
export async function resolveCustomer(clerkUserId: string, profile: Profile = {}) {
  const existing = await serverClient.fetch<{ _id: string; isActive?: boolean } | null>(CUSTOMER_SESSION_BY_CLERK_ID, { clerkUserId })
  if (existing) {
    if (existing.isActive === false) throw new HttpError(403, 'This account has been deactivated. Contact Cutty support.')
    return { customerId: existing._id, outcome: 'existing' as const }
  }

  const identity = await clerkIdentity(clerkUserId)
  if (!identity.email) throw new HttpError(403, 'Verify your email address to continue.')

  const legacy = await serverClient.fetch<{ _id: string; _rev: string; clerkUserId?: string } | null>(
    CUSTOMER_LINKABLE_BY_EMAIL,
    { email: identity.email },
  )
  if (legacy) {
    if (legacy.clerkUserId && legacy.clerkUserId !== clerkUserId) {
      throw new HttpError(409, 'This email is already linked to another sign-in. Contact Cutty support.')
    }
    // Passwords now live in Clerk; drop the old hash once the account is linked.
    await serverClient.patch(legacy._id).ifRevisionId(legacy._rev).set({ clerkUserId }).unset(['password']).commit()
    return { customerId: legacy._id, outcome: 'linked' as const }
  }

  // Fixed id per Clerk user: two first sign-ins racing create one account, not two.
  const _id = accountId('customer', clerkUserId)
  await serverClient.createIfNotExists({
    _id,
    _type: 'customer',
    clerkUserId,
    // Kept for compatibility with existing records; clerkUserId is the real key.
    uid: identity.email.replace(/[^a-z0-9]/g, ''),
    fullName: profile.fullName || identity.fullName || identity.email.split('@')[0],
    email: identity.email,
    phone: profile.phone,
    walletBalance: 0,
    loyaltyPoints: 0,
    totalVisits: 0,
    tier: 'bronze',
    preferredLanguage: 'en',
    preferredCurrency: 'NGN',
    notificationPreferences: { push: true, email: true, sms: false, promos: true },
    isActive: true,
    createdAt: now(),
  })
  return { customerId: _id, outcome: 'created' as const }
}
