import { create } from 'zustand'
import { ipc } from '../lib/ipc'
import type { QuotaSummary } from '@shared/types'

interface QuotaState {
  summary: QuotaSummary
  refresh: () => Promise<void>
}

export const useQuota = create<QuotaState>((set) => ({
  summary: { used: 0, total: 0, keys: [] },
  refresh: async () => {
    try {
      const summary = await ipc.quota.summary()
      set({ summary })
    } catch {
      /* ignore */
    }
  }
}))
