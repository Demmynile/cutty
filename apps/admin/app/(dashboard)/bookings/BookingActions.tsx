'use client'

import { useState } from 'react'
import { writeClient } from '@/lib/sanity'
import type { BookingStatus } from '@cutty/types'
import { useRouter } from 'next/navigation'

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
}

const ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  confirmed: 'Confirm',
  in_progress: 'Start',
  completed: 'Complete',
  cancelled: 'Cancel',
  no_show: 'No Show',
}

export function BookingActions({ bookingId, currentStatus }: { bookingId: string; currentStatus: BookingStatus }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const actions = TRANSITIONS[currentStatus] || []

  async function updateStatus(status: BookingStatus) {
    setLoading(true)
    await writeClient.patch(bookingId).set({ status }).commit()
    setLoading(false)
    router.refresh()
  }

  if (actions.length === 0) return <span className="text-gray-600 text-xs">—</span>

  return (
    <div className="flex gap-2">
      {actions.map((status) => (
        <button
          key={status}
          onClick={() => updateStatus(status)}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/40 transition-colors disabled:opacity-50"
        >
          {ACTION_LABEL[status] || status}
        </button>
      ))}
    </div>
  )
}
