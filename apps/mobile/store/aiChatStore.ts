import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AIChatMode, AIChatMessage } from '@cutty/types'

interface AIChatState {
  history: Record<AIChatMode, AIChatMessage[]>
  addMessage: (mode: AIChatMode, message: AIChatMessage) => void
  clearMode: (mode: AIChatMode) => void
  clearAll: () => void
}

export const useAIChatStore = create<AIChatState>()(
  persist(
    (set, get) => ({
      history: { styling: [], grooming: [] },

      addMessage: (mode, message) =>
        set({ history: { ...get().history, [mode]: [...get().history[mode], message] } }),

      clearMode: (mode) => set({ history: { ...get().history, [mode]: [] } }),

      clearAll: () => set({ history: { styling: [], grooming: [] } }),
    }),
    {
      name: 'cutty-ai-chat',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
