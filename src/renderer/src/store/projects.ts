import { create } from 'zustand'
import { ipc, type BatchUpdate } from '../lib/ipc'
import type { Project } from '@shared/types'

interface ProjectsState {
  list: Project[]
  current: Project | null
  loading: boolean
  refreshList: () => Promise<void>
  loadProject: (id: string) => Promise<void>
  setCurrent: (p: Project | null) => void
  applyBatchUpdate: (u: BatchUpdate) => void
}

export const useProjects = create<ProjectsState>((set, get) => ({
  list: [],
  current: null,
  loading: false,
  refreshList: async () => {
    set({ loading: true })
    const list = await ipc.projects.list()
    set({ list, loading: false })
  },
  loadProject: async (id) => {
    const p = await ipc.projects.get(id)
    set({ current: p })
  },
  setCurrent: (p) => set({ current: p }),
  applyBatchUpdate: (u) => {
    const cur = get().current
    if (cur && cur.id === u.projectId) {
      const next: Project = { ...cur }
      if (u.status) next.status = u.status
      if (u.row) {
        next.rows = cur.rows.map((r) => (r.id === u.row!.id ? u.row! : r))
      }
      set({ current: next })
    }
    // keep list status in sync too
    if (u.status) {
      set({
        list: get().list.map((p) =>
          p.id === u.projectId ? { ...p, status: u.status! } : p
        )
      })
    }
  }
}))
