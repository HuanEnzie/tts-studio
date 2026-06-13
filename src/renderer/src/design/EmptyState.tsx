import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
        <Icon className="h-7 w-7 text-ink-faint" strokeWidth={1.6} />
      </div>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {hint && <p className="mt-1 max-w-sm text-sm text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
