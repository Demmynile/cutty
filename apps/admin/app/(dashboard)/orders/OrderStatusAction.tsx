'use client'

import { useState } from 'react'
import { writeClient } from '@/lib/sanity'
import type { OrderStatus } from '@cutty/types'
import { useRouter } from 'next/navigation'

const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
}

const LABELS: Partial<Record<OrderStatus, string>> = {
  paid: 'Mark Paid',
  processing: 'Processing',
  shipped: 'Mark Shipped',
  delivered: 'Mark Delivered',
}

export function OrderStatusAction({ orderId, currentStatus }: { orderId: string; currentStatus: OrderStatus }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const next = TRANSITIONS[currentStatus]

  if (!next) return <span className="text-gray-600 text-xs">—</span>

  async function advance() {
    setLoading(true)
    await writeClient.patch(orderId).set({ status: next }).commit()
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={advance} disabled={loading} className="text-xs px-3 py-1 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/40 transition-colors disabled:opacity-50">
      {loading ? '...' : LABELS[next]}
    </button>
  )
}
