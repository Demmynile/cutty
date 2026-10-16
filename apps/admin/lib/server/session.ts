import { SignJWT, jwtVerify } from 'jose'

// Admin dashboard sessions only. Customers and stylists sign in with Clerk
// (lib/server/clerk.ts). Edge-safe (used by middleware.ts as well as route
// handlers): jose + Web Crypto only, no node: imports.

export const ADMIN_COOKIE = 'cutty_admin'
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60

const ISSUER = 'cutty'

function secret() {
  const raw = process.env.AUTH_JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('AUTH_JWT_SECRET is missing or shorter than 32 characters')
  }
  return new TextEncoder().encode(raw)
}

export type SessionClaims = {
  sub: string
  typ: 'admin'
  // Bumped on password change / deactivation / forced logout, which
  // invalidates every token issued before it.
  ver: number
  role?: 'owner' | 'staff'
}

export async function signSession(claims: SessionClaims, ttlSeconds: number) {
  return new SignJWT({ typ: claims.typ, ver: claims.ver, ...(claims.role ? { role: claims.role } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(claims.typ)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret())
}

export async function verifySession(token: string, typ: SessionClaims['typ']): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: typ, algorithms: ['HS256'] })
    if (payload.typ !== typ || typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      typ,
      ver: typeof payload.ver === 'number' ? payload.ver : 0,
      role: payload.role as SessionClaims['role'],
    }
  } catch {
    return null
  }
}
