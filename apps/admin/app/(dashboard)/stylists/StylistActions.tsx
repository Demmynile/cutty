'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reviewStylist, setSuspended, reviewShop } from './actions'

type Props = { stylistId: string; status: string; shopStatus: string }

export function StylistActions({ stylistId, status, shopStatus }: Props) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true)
    const result = await fn()
    setBusy(false)
    if (!result.ok) alert(result.error)
    router.refresh()
  }

  const note = (label: string) => prompt(label) ?? undefined
  const btn = 'text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50'

  return (
    <div className="flex flex-wrap gap-2">
      {(status === 'pending' || status === 'rejected') && (
        <>
          <button disabled={busy} className={`${btn} bg-green-500/20 text-green-400 hover:bg-green-500/40`} onClick={() => run(() => reviewStylist(stylistId, 'approve'))}>Approve profile</button>
          {status === 'pending' && (
            <button disabled={busy} className={`${btn} bg-red-500/20 text-red-400 hover:bg-red-500/40`} onClick={() => run(() => reviewStylist(stylistId, 'reject', note('Tell the stylist what to fix (they see this):')))}>Reject</button>
          )}
        </>
      )}
      {status === 'approved' && (
        <button disabled={busy} className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600`} onClick={() => run(() => setSuspended(stylistId, true), 'Suspend this stylist? They are signed out and hidden from customers.')}>Suspend</button>
      )}
      {status === 'suspended' && (
        <button disabled={busy} className={`${btn} bg-primary-500/20 text-primary-400 hover:bg-primary-500/40`} onClick={() => run(() => setSuspended(stylistId, false))}>Reinstate</button>
      )}
      {shopStatus === 'requested' && (
        <>
          <button disabled={busy} className={`${btn} bg-green-500/20 text-green-400 hover:bg-green-500/40`} onClick={() => run(() => reviewShop(stylistId, 'approve'), 'Approve the shop? This creates a Paystack subaccount for the bank account shown.')}>Approve shop</button>
          <button disabled={busy} className={`${btn} bg-red-500/20 text-red-400 hover:bg-red-500/40`} onClick={() => run(() => reviewShop(stylistId, 'reject', note('Reason (the stylist sees this):')))}>Reject shop</button>
        </>
      )}
      {shopStatus === 'approved' && (
        <button disabled={busy} className={`${btn} bg-gray-700 text-gray-300 hover:bg-gray-600`} onClick={() => run(() => reviewShop(stylistId, 'suspend', note('Reason:')), 'Suspend this shop? Its products are hidden immediately.')}>Suspend shop</button>
      )}
      {shopStatus === 'suspended' && (
        <button disabled={busy} className={`${btn} bg-primary-500/20 text-primary-400 hover:bg-primary-500/40`} onClick={() => run(() => reviewShop(stylistId, 'approve'))}>Reopen shop</button>
      )}
    </div>
  )
}
