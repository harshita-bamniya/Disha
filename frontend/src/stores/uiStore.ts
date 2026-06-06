import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '@/types'

interface UIState {
  language: Language
  sidebarOpen: boolean
  setLanguage: (lang: Language) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      language: 'hi',
      sidebarOpen: true,

      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'disha-ui',
      partialize: (state) => ({ language: state.language }),
    }
  )
)
