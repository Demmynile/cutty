import { create } from 'zustand'
import type { DiscountCode, StylistPublic } from '@cutty/types'

// Customers book a stylist (found on the map or in search), not a service:
// the stylist's appointment price and length set the total and the slot.
interface BookingDraft {
  stylist: StylistPublic | null
  /** A style from the stylist's list, or null for "not sure yet". */
  style: string | null
  date: string | null
  time: string | null
  notes: string
  discountCode: DiscountCode | null
}

interface BookingState {
  draft: BookingDraft
  setStylist: (stylist: StylistPublic | null) => void
  setStyle: (style: string | null) => void
  setDate: (date: string) => void
  setTime: (time: string) => void
  setNotes: (notes: string) => void
  setDiscountCode: (code: DiscountCode | null) => void
  resetDraft: () => void
  totalAmount: () => number
  totalDuration: () => number
  totalPoints: () => number
  discount: () => number
  finalAmount: () => number
}

const initialDraft: BookingDraft = {
  stylist: null,
  style: null,
  date: null,
  time: null,
  notes: '',
  discountCode: null,
}

export const useBookingStore = create<BookingState>((set, get) => ({
  draft: initialDraft,

  // A different stylist has different styles, hours and price: start over.
  setStylist: (stylist) => set((s) => (s.draft.stylist?._id === stylist?._id
    ? { draft: { ...s.draft, stylist } }
    : { draft: { ...initialDraft, stylist } })),
  setStyle: (style) => set((s) => ({ draft: { ...s.draft, style } })),
  setDate: (date) => set((s) => ({ draft: { ...s.draft, date, time: null } })),
  setTime: (time) => set((s) => ({ draft: { ...s.draft, time } })),
  setNotes: (notes) => set((s) => ({ draft: { ...s.draft, notes } })),
  setDiscountCode: (discountCode) => set((s) => ({ draft: { ...s.draft, discountCode } })),
  resetDraft: () => set({ draft: initialDraft }),

  totalAmount: () => get().draft.stylist?.bookingPrice ?? 0,

  totalDuration: () => get().draft.stylist?.bookingDuration ?? 60,

  // Same rule the server applies: 1 point per ₦100.
  totalPoints: () => Math.floor(get().totalAmount() / 10_000),

  discount: () => {
    const code = get().draft.discountCode
    if (!code) return 0
    const total = get().totalAmount()
    if (code.type === 'percentage') {
      const d = Math.round((total * code.value) / 100)
      return code.maxDiscountAmount ? Math.min(d, code.maxDiscountAmount) : d
    }
    return Math.min(code.value, total)
  },

  finalAmount: () => get().totalAmount() - get().discount(),
}))
