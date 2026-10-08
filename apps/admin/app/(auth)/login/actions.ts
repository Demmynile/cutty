'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { verifyPassword, verifyDummy, needsRehash, hashPassword } from '@/lib/server/password'
import { verifyTotp } from '@/lib/server/totp'
import { signSession, ADMIN_COOKIE, ADMIN_SESSION_SECONDS } from '@/lib/server/session'
import { rateLimit, resetRateLimit } from '@/lib/server/rateLimit'
import { HttpError } from '@/lib/server/http'
import { audit } from '@/lib/server/audit'
import { getAdmin } from '@/lib/server/adminAuth'
import { ADMIN_BY_EMAIL } from '@/lib/server/queries'

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/),
})

type AdminRow = {
  _id: string; email: string; name: string; role: 'owner' | 'staff'
  passwordHash?: string; totpSecret?: string; isActive?: boolean; sessionVersion?: number
}

const GENERIC = 'Invalid email, password or authenticator code.'

export async function login(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const parsed = schema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: GENERIC }
  const { email, password, code } = parsed.data

  try {
    rateLimit(`admin-login:ip:${ip}`, 20, 15 * 60 * 1000)
    rateLimit(`admin-login:acct:${email}`, 5, 15 * 60 * 1000)
  } catch (err) {
    if (err instanceof HttpError) return { error: err.message }
    throw err
  }

  const admin = await serverClient.fetch<AdminRow | null>(ADMIN_BY_EMAIL, { email })
  const fail = async (reason: string) => {
    await audit({ action: 'admin.login', actor: { type: 'admin', id: admin?._id ?? 'unknown', email }, outcome: 'failure', ip, details: { reason } })
    return { error: GENERIC }
  }

  if (!admin || admin.isActive === false || !admin.passwordHash) {
    await verifyDummy(password)
    return fail(admin ? 'inactive' : 'no_account')
  }
  if (!(await verifyPassword(password, admin.passwordHash))) return fail('bad_password')
  // MFA is mandatory: an admin without an enrolled authenticator can't sign in.
  if (!admin.totpSecret || !verifyTotp(admin.totpSecret, code)) return fail('bad_totp')

  resetRateLimit(`admin-login:acct:${email}`)
  if (needsRehash(admin.passwordHash)) {
    await serverClient.patch(admin._id).set({ passwordHash: await hashPassword(password) }).commit()
  }
  await serverClient.patch(admin._id).set({ lastLoginAt: new Date().toISOString() }).commit()

  const token = await signSession({ sub: admin._id, typ: 'admin', ver: admin.sessionVersion ?? 0, role: admin.role }, ADMIN_SESSION_SECONDS)
  ;(await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  })
  await audit({ action: 'admin.login', actor: { type: 'admin', id: admin._id, email }, ip })
  redirect('/dashboard')
}

export async function logout() {
  const admin = await getAdmin()
  ;(await cookies()).delete(ADMIN_COOKIE)
  if (admin) await audit({ action: 'admin.logout', actor: { type: 'admin', id: admin.id, email: admin.email } })
  redirect('/login')
}
