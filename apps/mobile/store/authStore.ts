import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getClerkInstance } from '@clerk/expo'
import type { Customer, StylistAccount } from '@cutty/types'
import { clearAuthData, type AuthRole } from '@/lib/auth'
import { setUnauthorizedHandler } from '@/lib/api'
import { disconnectRealtime } from '@/lib/realtime'
import { queryClient } from '@/lib/data'

// One signed-in account at a time: a customer or a Cutty Pro stylist. The
// account is cached on the device so a signed-in user opens straight into the
// app even while the API server is down or still starting; app/_layout.tsx
// refreshes it from the server in the background.
interface AuthState {
  role: AuthRole | null
  customer: Customer | null
  stylist: StylistAccount | null
  isAuthenticated: boolean
  isLoading: boolean
  /** True once the cached account has been read back from storage. */
  hydrated: boolean
  setCustomer: (customer: Customer | null) => void
  setStylist: (stylist: StylistAccount | null) => void
  setLoading: (loading: boolean) => void
  updateCustomer: (updates: Partial<Customer>) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  role: null,
  customer: null,
  stylist: null,
  isAuthenticated: false,
  isLoading: true,
  hydrated: false,

  setCustomer: (customer) =>
    set({ customer, stylist: null, role: customer ? 'customer' : null, isAuthenticated: !!customer, isLoading: false }),

  setStylist: (stylist) =>
    set({ stylist, customer: null, role: stylist ? 'stylist' : null, isAuthenticated: !!stylist, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  updateCustomer: (updates) => {
    const current = get().customer
    if (current) {
      set({ customer: { ...current, ...updates } })
    }
  },

  signOut: async () => {
    disconnectRealtime()
    // Drop every cached API response so the next account never sees this one's data.
    queryClient.clear()
    await clearAuthData()
    set({ customer: null, stylist: null, role: null, isAuthenticated: false })
  },
}), {
  name: 'cutty-auth',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ role, customer, stylist, isAuthenticated }) => ({ role, customer, stylist, isAuthenticated }),
  onRehydrateStorage: () => () => {
    useAuthStore.setState({ hydrated: true })
  },
}))

/** Where a signed-in account lands. */
export function homeFor(role: AuthRole | null) {
  return role === 'stylist' ? '/(pro)' : '/(tabs)'
}

// A 401 means the server couldn't verify the token. Clerk refreshes tokens
// itself, so while Clerk still holds a session this is a server-side problem
// (restarting, misconfigured) and the user stays signed in. Only sign out
// once Clerk's session is really gone.
setUnauthorizedHandler(() => {
  const { isAuthenticated, signOut } = useAuthStore.getState()
  if (isAuthenticated && !getClerkInstance().session) signOut()
})
