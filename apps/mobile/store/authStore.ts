import { create } from 'zustand'
import type { Customer } from '@cutty/types'
import { clearAuthData, storeAuthData } from '@/lib/auth'

interface AuthState {
  customer: Customer | null
  isAuthenticated: boolean
  isLoading: boolean
  setCustomer: (customer: Customer | null) => void
  setLoading: (loading: boolean) => void
  updateCustomer: (updates: Partial<Customer>) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  customer: null,
  isAuthenticated: false,
  isLoading: true,

  setCustomer: (customer) =>
    set({ customer, isAuthenticated: !!customer, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  updateCustomer: (updates) => {
    const current = get().customer
    if (current) {
      set({ customer: { ...current, ...updates } })
    }
  },

  signOut: async () => {
    await clearAuthData()
    set({ customer: null, isAuthenticated: false })
  },
}))
