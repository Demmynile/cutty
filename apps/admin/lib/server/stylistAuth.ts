import 'server-only'
import { serverClient } from './sanity'
import { HttpError } from './http'
import { requireClerkUser, clerkIdentity } from './clerk'
import { STYLIST_SESSION_BY_CLERK_ID, STYLIST_LINKABLE_BY_EMAIL } from './proQueries'
import type { ShopStatus, StylistStatus } from '@cutty/types'

export type StylistSession = {
  stylistId: string
  email: string
  status: StylistStatus
  shopStatus: ShopStatus
  barberId?: string
}

type Options = {
  /** Profile must be admin-approved (bookings, chat, customers, bonuses). */
  approved?: boolean
  /** Shop must be admin-approved (products and sales). */
  shop?: boolean
}

type SessionRow = {
  _id: string; email: string; isActive?: boolean
  status?: StylistStatus; shopStatus?: ShopStatus; barberId?: string
}

// Every Cutty Pro route starts here. The stylist is looked up from the
// verified Clerk token, so one stylist can't act as another. A Clerk user
// only reaches these routes once they have a `stylist` document (created by
// POST /api/v1/pro/auth/register); the same person may also be a customer.
export async function requireStylist(req: Request, opts: Options = {}): Promise<StylistSession> {
  const clerkUserId = await requireClerkUser(req)
  const stylist = await serverClient.fetch<SessionRow | null>(STYLIST_SESSION_BY_CLERK_ID, { clerkUserId })

  // 401 is reserved for an unverifiable token, so the app can tell a server
  // hiccup apart from an account that is really gone.
  if (!stylist) throw new HttpError(404, 'We could not find your Cutty account. Please sign in again.')
  if (stylist.isActive === false) throw new HttpError(403, 'This account has been deactivated. Contact Cutty support.')
  const status = stylist.status ?? 'pending'
  const shopStatus = stylist.shopStatus ?? 'none'
  if (status === 'suspended') throw new HttpError(403, 'Your Cutty Pro account is suspended. Contact Cutty support.')
  if ((opts.approved || opts.shop) && status !== 'approved') {
    throw new HttpError(403, 'Your profile is still under review. You can use this once Cutty approves it.')
  }
  if (opts.shop && shopStatus !== 'approved') {
    throw new HttpError(403, 'Your shop has not been approved yet.')
  }
  return { stylistId: stylist._id, email: stylist.email, status, shopStatus, barberId: stylist.barberId }
}

/**
 * The stylist id for a Clerk user, or null if they haven't set up Cutty Pro
 * yet. A pre-Clerk stylist account with the same verified email is linked.
 */
export async function findStylist(clerkUserId: string): Promise<{ stylistId: string; linked: boolean } | null> {
  const existing = await serverClient.fetch<SessionRow | null>(STYLIST_SESSION_BY_CLERK_ID, { clerkUserId })
  if (existing) {
    if (existing.isActive === false) throw new HttpError(403, 'This Cutty Pro account has been deactivated. Contact Cutty support.')
    return { stylistId: existing._id, linked: false }
  }

  const { email } = await clerkIdentity(clerkUserId)
  if (!email) return null
  const legacy = await serverClient.fetch<{ _id: string; _rev: string; clerkUserId?: string } | null>(STYLIST_LINKABLE_BY_EMAIL, { email })
  if (!legacy) return null
  if (legacy.clerkUserId && legacy.clerkUserId !== clerkUserId) {
    throw new HttpError(409, 'This email is already linked to another sign-in. Contact Cutty support.')
  }
  await serverClient.patch(legacy._id).ifRevisionId(legacy._rev).set({ clerkUserId }).unset(['password']).commit()
  return { stylistId: legacy._id, linked: true }
}
