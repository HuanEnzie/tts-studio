import { useEffect, useState } from 'react'
import { Timer, KeyRound, DollarSign } from 'lucide-react'
import { msUntilPacificMidnight } from '@shared/pacific'
import { useQuota } from '../store/quota'
import { ipc } from '../lib/ipc'
import type { CostSummary } from '@shared/types'

function fmtCountdown(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export function QuotaBar() {
  const summary = useQuota((s) => s.summary)
  const refresh = useQuota((s) => s.refresh)
  const [ms, setMs] = useState(() => msUntilPacificMidnight(new Date()))
  const [cost, setCost] = useState<CostSummary | null>(null)

  useEffect(() => {
    const load = () => {
      refresh()
      ipc.cost.summary().then(setCost).catch(() => {})
    }
    load()
    const tick = setInterval(() => setMs(msUntilPacificMidnight(new Date())), 1000)
    const poll = setInterval(load, 5000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [refresh])

  const { freeUsed, freeTotal, paidUsed, activeKeys } = summary
  const remaining = Math.max(0, freeTotal - freeUsed)
  const pct = freeTotal > 0 ? Math.min(100, (freeUsed / freeTotal) * 100) : 0
  const dayPct = (1 - ms / 86_400_000) * 100

  return (
    <div className="flex items-center gap-5 border-t border-border/60 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        <KeyRound className="h-3.5 w-3.5 text-ink-faint" />
        <span className="tnum">{activeKeys} key</span>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <span className="text-xs text-ink-muted">Free hôm nay</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent-gradient transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tnum text-xs text-ink">
          <span className="font-semibold">{remaining}</span>
          <span className="text-ink-faint"> / {freeTotal} còn lại</span>
        </span>
        {paidUsed > 0 && (
          <span className="tnum rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent-to">
            Paid: {paidUsed}
          </span>
        )}
      </div>

      {cost && (
        <div
          className={
            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ' +
            (cost.dailyBudgetUsd > 0 && cost.todayUsd >= cost.dailyBudgetUsd
              ? 'border-status-error/40 text-status-error'
              : 'border-border text-ink-muted')
          }
          title="Chi tiêu hôm nay"
        >
          <DollarSign className="h-3.5 w-3.5" />
          <span className="tnum">{cost.todayUsd.toFixed(3)}{cost.dailyBudgetUsd > 0 ? ` / ${cost.dailyBudgetUsd}` : ''}</span>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1">
        <div className="relative h-4 w-4">
          <svg viewBox="0 0 36 36" className="h-4 w-4 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#26262E" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="url(#qg)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(dayPct / 100) * 94.2} 94.2`}
            />
            <defs>
              <linearGradient id="qg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7C5CFF" />
                <stop offset="100%" stopColor="#00D4FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <Timer className="h-3.5 w-3.5 text-ink-faint" />
        <span className="tnum text-xs text-ink-muted">
          reset sau <span className="text-ink">{fmtCountdown(ms)}</span>
        </span>
      </div>
    </div>
  )
}
