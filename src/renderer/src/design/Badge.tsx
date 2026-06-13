import { cn } from './cn'

export type Status = 'pending' | 'running' | 'done' | 'error' | 'warn'

const map: Record<Status, { dot: string; text: string; bg: string; label: string }> = {
  pending: { dot: 'bg-status-pending', text: 'text-ink-muted', bg: 'bg-surface-hover', label: 'Chờ' },
  running: { dot: 'bg-status-running', text: 'text-status-running', bg: 'bg-status-running/10', label: 'Đang chạy' },
  done: { dot: 'bg-status-done', text: 'text-status-done', bg: 'bg-status-done/10', label: 'Hoàn tất' },
  error: { dot: 'bg-status-error', text: 'text-status-error', bg: 'bg-status-error/10', label: 'Lỗi' },
  warn: { dot: 'bg-status-warn', text: 'text-status-warn', bg: 'bg-status-warn/10', label: 'Một phần' }
}

export function Badge({ status, label }: { status: Status; label?: string }) {
  const s = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        s.bg,
        s.text
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          s.dot,
          status === 'running' && 'animate-pulse'
        )}
      />
      {label ?? s.label}
    </span>
  )
}
