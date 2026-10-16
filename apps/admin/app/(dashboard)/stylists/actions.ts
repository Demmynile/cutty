'use server'

import { revalidatePath } from 'next/cache'
import { FEATURES } from '@cutty/types'
import { serverClient, now } from '@/lib/server/sanity'
import { requireAdmin } from '@/lib/server/adminAuth'
import { audit } from '@/lib/server/audit'
import { syncBarber } from '@/lib/server/stylists'
import { invalidateCatalog } from '@/lib/server/cache'
import { createSubaccount } from '@/lib/server/paystack'
import { marketplaceSettings } from '@/lib/server/stylistStats'

type Result = { ok: true } | { ok: false; error: string }

type StylistRow = {
  _id: string; _rev: string; email: string; fullName: string; displayName?: string
  status?: string; sessionVersion?: number
  shop?: { status?: string; name?: string; bankCode?: string; accountNumber?: string; subaccountCode?: string }
}

async function load(id: string) {
  return serverClient.fetch<StylistRow | null>(
    `*[_type == "stylist" && _id == $id][0]{ _id, _rev, email, fullName, displayName, status, sessionVersion, shop }`,
    { id },
  )
}

// Marketplace decisions (who can take bookings and money through Cutty) are
// owner-only. Every change is audited.
async function owner() {
  const admin = await requireAdmin()
  if (admin.role !== 'owner') throw new Error('Only an owner can review stylists')
  return admin
}

async function done(action: string, admin: { id: string; email: string }, stylistId: string, details?: Record<string, unknown>) {
  await invalidateCatalog()
  revalidatePath('/stylists')
  return audit({ action: `admin.${action}`, actor: { type: 'admin', id: admin.id, email: admin.email }, target: { type: 'stylist', id: stylistId }, details })
}

export async function reviewStylist(stylistId: string, decision: 'approve' | 'reject', note?: string): Promise<Result> {
  try {
    const admin = await owner()
    const s = await load(stylistId)
    if (!s) return { ok: false, error: 'Stylist not found' }
    if (s.status !== 'pending' && s.status !== 'rejected') return { ok: false, error: `This stylist is already ${s.status}` }
    await serverClient
      .patch(s._id)
      .ifRevisionId(s._rev)
      .set(decision === 'approve'
        ? { status: 'approved', approvedAt: now(), approvedBy: admin.email, reviewNote: note ?? '' }
        : { status: 'rejected', reviewNote: note || 'Your profile needs more detail before we can list it.' })
      .commit()
    if (decision === 'approve') await syncBarber(s._id)
    await done(`stylist_${decision}`, admin, s._id, { note })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

// Suspending signs the stylist out everywhere, hides their bookable profile
// and (through the product queries) their shop.
export async function setSuspended(stylistId: string, suspended: boolean): Promise<Result> {
  try {
    const admin = await owner()
    const s = await load(stylistId)
    if (!s) return { ok: false, error: 'Stylist not found' }
    await serverClient
      .patch(s._id)
      .set(suspended
        ? { status: 'suspended', sessionVersion: (s.sessionVersion ?? 0) + 1 }
        : { status: 'approved' })
      .commit()
    await syncBarber(s._id)
    await done(suspended ? 'stylist_suspend' : 'stylist_reinstate', admin, s._id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

// Approving a shop creates the stylist's Paystack subaccount, so card
// payments for their products split automatically (Cutty keeps commission).
export async function reviewShop(stylistId: string, decision: 'approve' | 'reject' | 'suspend', note?: string): Promise<Result> {
  try {
    if (!FEATURES.shop) return { ok: false, error: 'Shops are not available yet' }
    const admin = await owner()
    const s = await load(stylistId)
    if (!s?.shop) return { ok: false, error: 'No shop request' }
    if (decision === 'approve') {
      if (s.status !== 'approved') return { ok: false, error: 'Approve the stylist profile first' }
      if (!s.shop.bankCode || !s.shop.accountNumber) return { ok: false, error: 'Shop has no bank account' }
      const { commissionPercent } = await marketplaceSettings()
      const subaccountCode = s.shop.subaccountCode ?? await createSubaccount({
        businessName: s.shop.name || s.displayName || s.fullName,
        bankCode: s.shop.bankCode,
        accountNumber: s.shop.accountNumber,
        commissionPercent,
        email: s.email,
      })
      await serverClient.patch(s._id).set({
        'shop.status': 'approved', 'shop.subaccountCode': subaccountCode, 'shop.commissionPercent': commissionPercent,
        'shop.reviewedAt': now(), 'shop.reviewNote': note ?? '',
      }).commit()
    } else {
      await serverClient.patch(s._id).set({
        'shop.status': decision === 'reject' ? 'rejected' : 'suspended', 'shop.reviewedAt': now(), 'shop.reviewNote': note ?? '',
      }).commit()
    }
    await done(`shop_${decision}`, admin, s._id, { note })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}
