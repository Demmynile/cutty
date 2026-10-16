import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface OnboardingState {
  /** True once the user has ever finished or skipped the slideshow (persisted). */
  seen: boolean
  /** True once the persisted value has been read back from storage. */
  hydrated: boolean
  /**
   * True once the slideshow has been dismissed during the current app session.
   * Deliberately NOT persisted, so it resets on every cold start and the intro
   * plays again each time the app is opened.
   */
  completedThisSession: boolean
  markSeen: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      hydrated: false,
      completedThisSession: false,
      markSeen: () => set({ seen: true, completedThisSession: true }),
    }),
    {
      name: 'cutty-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ seen: state.seen }),
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hydrated: true })
      },
    }
  )
)
