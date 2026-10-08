import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { serverClient } from './sanity'
import { ADMIN_COOKIE, verifySession } from './session'
import { ADMIN_SESSION_BY_ID } from './queries'

export type AdminSession = { id: string; email: string; name: string; role: 'owner' | 'staff' }

// Middleware already rejects requests without a valid cookie; this re-checks
// against the database so deactivating an admin (or bumping sessionVersion)
// takes effect immediately rather than when the JWT expires.
export async function getAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) return null
  const claims = await verifySession(token, 'admin')
  if (!claims) return null
  const admin = await serverClient.fetch<{ _id: string; email: string; name: string; role: 'owner' | 'staff'; isActive?: boolean; sessionVersion?: number } | null>(
    ADMIN_SESSION_BY_ID,
    { id: claims.sub },
  )
  if (!admin || admin.isActive === false || (admin.sessionVersion ?? 0) !== claims.ver) return null
  return { id: admin._id, email: admin.email, name: admin.name, role: admin.role }
}

export async function requireAdmin(role?: 'owner'): Promise<AdminSession> {
  const admin = await getAdmin()
  if (!admin) redirect('/login')
  if (role && admin.role !== role) throw new Error('Forbidden')
  return admin
}
