import { create } from 'zustand'

export type Route = 'projects' | 'project' | 'quick' | 'keys' | 'settings'

interface NavState {
  route: Route
  projectId: string | null
  go: (r: Route) => void
  openProject: (id: string) => void
}

export const useNav = create<NavState>((set) => ({
  route: 'projects',
  projectId: null,
  go: (route) => set({ route }),
  openProject: (id) => set({ route: 'project', projectId: id })
}))
