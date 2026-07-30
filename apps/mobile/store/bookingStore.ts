import { create } from 'zustand'
import type { Barber, DiscountCode, Service } from '@cutty/types'

interface BookingDraft {
  services: Service[]
  barber: Barber | null
  date: string | null
  time: string | null
  notes: string
  discountCode: DiscountCode | null
}

interface BookingState {
  draft: BookingDraft
  setServices: (services: Service[]) => void
  addService: (service: Service) => void
  removeService: (serviceId: string) => void
  setBarber: (barber: Barber | null) => void
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
  services: [],
  barber: null,
  date: null,
  time: null,
  notes: '',
  discountCode: null,
}

export const useBookingStore = create<BookingState>((set, get) => ({
  draft: initialDraft,

  setServices: (services) => set((s) => ({ draft: { ...s.draft, services } })),

  addService: (service) => {
    const { services } = get().draft
    if (!services.find((s) => s._id === service._id)) {
      set((s) => ({ draft: { ...s.draft, services: [...services, service] } }))
    }
  },

  removeService: (serviceId) =>
    set((s) => ({
      draft: { ...s.draft, services: s.draft.services.filter((sv) => sv._id !== serviceId) },
    })),

  setBarber: (barber) => set((s) => ({ draft: { ...s.draft, barber } })),
  setDate: (date) => set((s) => ({ draft: { ...s.draft, date, time: null } })),
  setTime: (time) => set((s) => ({ draft: { ...s.draft, time } })),
  setNotes: (notes) => set((s) => ({ draft: { ...s.draft, notes } })),
  setDiscountCode: (discountCode) => set((s) => ({ draft: { ...s.draft, discountCode } })),
  resetDraft: () => set({ draft: initialDraft }),

  totalAmount: () => get().draft.services.reduce((sum, s) => sum + s.price, 0),

  totalDuration: () => get().draft.services.reduce((sum, s) => sum + s.duration, 0),

  totalPoints: () => get().draft.services.reduce((sum, s) => sum + s.pointsEarned, 0),

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
