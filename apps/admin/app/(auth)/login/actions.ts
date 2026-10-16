'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { serverClient } from '@/lib/server/sanity'
import { verifyPassword, verifyDummy, needsRehash, hashPassword } from '@/lib/server/password'
import { matchTotp } from '@/lib/server/totp'
import { signSession, ADMIN_COOKIE, ADMIN_SESSION_SECONDS } from '@/lib/server/session'
import { rateLimit, resetRateLimit } from '@/lib/server/rateLimit'
import { HttpError, ipFromHeaders } from '@/lib/server/http'
import { audit } from '@/lib/server/audit'
import { getAdmin } from '@/lib/server/adminAuth'
import { ADMIN_BY_EMAIL } from '@/lib/server/queries'

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/),
})

type AdminRow = {
  _id: string; _rev: string; email: string; name: string; role: 'owner' | 'staff'
  passwordHash?: string; totpSecret?: string; totpLastStep?: number; isActive?: boolean; sessionVersion?: number
}

const GENERIC = 'Invalid email, password or authenticator code.'

export async function login(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const h = await headers()
  const ip = ipFromHeaders((n) => h.get(n))
  const parsed = schema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: GENERIC }
  const { email, password, code } = parsed.data

  try {
    await rateLimit(`admin-login:ip:${ip}`, 20, 15 * 60 * 1000)
    await rateLimit(`admin-login:acct:${email}`, 5, 15 * 60 * 1000)
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
  const step = admin.totpSecret ? matchTotp(admin.totpSecret, code) : null
  if (step === null) return fail('bad_totp')
  // A code works once: refuse one already used (replay), even within its 30s window.
  if (admin.totpLastStep !== undefined && step <= admin.totpLastStep) return fail('totp_reused')

  // Conditional on the revision we read, so two logins racing with the same
  // code can't both succeed.
  try {
    await serverClient
      .patch(admin._id)
      .ifRevisionId(admin._rev)
      .set({
        totpLastStep: step,
        lastLoginAt: new Date().toISOString(),
        ...(needsRehash(admin.passwordHash) ? { passwordHash: await hashPassword(password) } : {}),
      })
      .commit()
  } catch {
    return fail('totp_race')
  }
  await resetRateLimit(`admin-login:acct:${email}`)

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
  if (admin) {
    // Revoke the token itself (not just the cookie), so a copied cookie stops
    // working too. This signs the admin out on their other devices as well.
    await serverClient.patch(admin.id).setIfMissing({ sessionVersion: 0 }).inc({ sessionVersion: 1 }).commit()
    await audit({ action: 'admin.logout', actor: { type: 'admin', id: admin.id, email: admin.email } })
  }
  redirect('/login')
}
