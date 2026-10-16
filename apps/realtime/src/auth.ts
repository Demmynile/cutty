import { verifyToken as verifyClerkToken } from '@clerk/backend'

// The app connects with the same Clerk session token it sends to the API
// (apps/admin/lib/server/clerk.ts) plus the role it's signed in as. The
// token proves who the Clerk user is; store.resolvePrincipal maps them to
// their customer or stylist document. Admins never connect here.
export type Role = 'customer' | 'stylist'

const authorizedParties = () => (process.env.CLERK_AUTHORIZED_PARTIES || '').split(',').map((s) => s.trim()).filter(Boolean)

export async function verifyToken(token: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set')
  try {
    const claims = await verifyClerkToken(token, {
      secretKey,
      jwtKey: process.env.CLERK_JWT_KEY || undefined,
      // Same allow-list as the API (apps/admin/lib/server/clerk.ts).
      authorizedParties: authorizedParties().length ? authorizedParties() : undefined,
    })
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null
  } catch {
    return null
  }
}
