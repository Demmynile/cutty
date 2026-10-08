import { create } from 'zustand'
import type { Customer } from '@cutty/types'
import { clearAuthData } from '@/lib/auth'
import { setUnauthorizedHandler } from '@/lib/api'

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

// A revoked or expired session (401 from the API) signs the user out.
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().signOut()
})
