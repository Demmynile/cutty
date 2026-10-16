import 'server-only'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { HttpError } from './http'

// Customers and Cutty Pro stylists sign in with Clerk (email + password or
// Google) in the mobile app, which sends the short-lived Clerk session token
// as `Authorization: Bearer`. We verify it here and map the Clerk user to our
// own `customer` / `stylist` document via `clerkUserId`. Admins do NOT use
// Clerk: they keep the cookie + TOTP login in lib/server/adminAuth.ts.

function secretKey() {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) throw new Error('CLERK_SECRET_KEY is not set')
  return key
}

let client: ReturnType<typeof createClerkClient> | null = null
export function clerk() {
  client ??= createClerkClient({ secretKey: secretKey() })
  return client
}

const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function bearer(req: Request) {
  const header = req.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/** Verifies the request's Clerk session token and returns the Clerk user id. */
export async function requireClerkUser(req: Request): Promise<string> {
  const token = bearer(req)
  if (!token) throw new HttpError(401, 'Please sign in')
  // Read outside the try: a missing key is a server misconfiguration (500),
  // not something the user can fix by signing in again.
  const key = secretKey()
  try {
    const claims = await verifyToken(token, {
      secretKey: key,
      // Optional networkless verification (PEM public key from the Clerk dashboard).
      jwtKey: process.env.CLERK_JWT_KEY || undefined,
      authorizedParties: authorizedParties.length ? authorizedParties : undefined,
    })
    if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('missing sub')
    return claims.sub
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.')
  }
}

export type ClerkIdentity = {
  clerkUserId: string
  /** Primary email, only when Clerk has verified it (email code or Google). */
  email: string | null
  fullName: string | null
}

/** The user's profile as Clerk knows it. Only verified emails are returned. */
export async function clerkIdentity(clerkUserId: string): Promise<ClerkIdentity> {
  const user = await clerk().users.getUser(clerkUserId)
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
  const email = primary?.verification?.status === 'verified' ? primary.emailAddress.trim().toLowerCase() : null
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
  return { clerkUserId, email, fullName }
}

/** Removes the Clerk user (account deletion). Missing users are ignored. */
export async function deleteClerkUser(clerkUserId: string) {
  try {
    await clerk().users.deleteUser(clerkUserId)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 404) throw err
  }
}
