import { useEffect, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar } from './layout/TitleBar'
import { Sidebar } from './layout/Sidebar'
import { QuotaBar } from './layout/QuotaBar'
import { Toaster } from './design/Toaster'
import { useNav, type Route } from './store/nav'
import { useProjects } from './store/projects'
import { useQuota } from './store/quota'
import { toast } from './store/toast'
import { ipc } from './lib/ipc'
import { Projects } from './routes/Projects'
import { ProjectDetail } from './routes/ProjectDetail'
import { Keys } from './routes/Keys'
import { VoiceLibrary } from './routes/VoiceLibrary'
import { Settings } from './routes/Settings'

const pages: Record<Route, ComponentType> = {
  projects: Projects,
  project: ProjectDetail,
  keys: Keys,
  library: VoiceLibrary,
  settings: Settings
}

const shortcutRoutes: Route[] = ['projects', 'keys', 'library', 'settings']

export default function App() {
  const route = useNav((s) => s.route)
  const go = useNav((s) => s.go)
  const Page = pages[route]
  const applyBatchUpdate = useProjects((s) => s.applyBatchUpdate)
  const refreshQuota = useQuota((s) => s.refresh)

  // realtime batch progress from the main process
  useEffect(() => {
    const off = ipc.batch.onUpdate((u) => {
      applyBatchUpdate(u)
      if (u.quotaExhausted) toast.info('Đã hết lượt free hôm nay — sẽ tiếp tục sau khi reset (hoặc thêm key Paid)')
      if (u.blocked) toast.error(u.blocked)
      if (u.finished && u.status === 'done') toast.success('Đã tạo xong tất cả!')
      refreshQuota()
    })
    return off
  }, [applyBatchUpdate, refreshQuota])

  // keyboard shortcuts: Ctrl+1..4 switch sections, Esc returns to projects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        go(shortcutRoutes[Number(e.key) - 1])
      }
      if (e.key === 'Escape' && useNav.getState().route === 'project') go('projects')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // dev hooks for the screenshot harness
  useEffect(() => {
    const w = window as unknown as {
      __setRoute?: (r: string) => void
      __openProject?: (id: string) => void
    }
    w.__setRoute = (r) => useNav.getState().go(r as never)
    w.__openProject = (id) => useNav.getState().openProject(id)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <Page />
            </motion.div>
          </AnimatePresence>
          <QuotaBar />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
