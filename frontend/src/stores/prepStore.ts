import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivePrepJobContext } from '../api/krs'

interface PrepStore {
  activePrep: ActivePrepJobContext | null
  setActivePrep: (ctx: ActivePrepJobContext | null) => void
  clearActivePrep: () => void
}

export const usePrepStore = create<PrepStore>()(
  persist(
    (set) => ({
      activePrep: null,
      setActivePrep: (ctx) => set({ activePrep: ctx }),
      clearActivePrep: () => set({ activePrep: null }),
    }),
    {
      name: 'disha-active-prep',
    }
  )
)
