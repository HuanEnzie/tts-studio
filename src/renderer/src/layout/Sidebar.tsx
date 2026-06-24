import { motion } from 'framer-motion'
import { FolderKanban, KeyRound, Library, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNav, type Route } from '../store/nav'
import { cn } from '../design/cn'

const items: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'projects', label: 'Dự án', icon: FolderKanban },
  { route: 'keys', label: 'API Keys', icon: KeyRound },
  { route: 'library', label: 'Thư viện giọng', icon: Library },
  { route: 'settings', label: 'Cài đặt', icon: Settings }
]

export function Sidebar() {
  const { route, go } = useNav()
  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-border/60 p-3">
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = route === it.route
          const Icon = it.icon
          return (
            <button
              key={it.route}
              onClick={() => go(it.route)}
              className={cn(
                'no-drag relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                active ? 'text-ink' : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-accent-soft border border-accent-from/25"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative h-[18px] w-[18px]" strokeWidth={2} />
              <span className="relative font-medium">{it.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
