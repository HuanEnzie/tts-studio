import type { ApiKey, KeyQuota } from './types'

export interface KeyState {
  key: ApiKey
  quota: KeyQuota
}

function isUsable(s: KeyState): boolean {
  if (!s.key.active || s.key.banned || s.quota.exhausted) return false
  if (s.key.tier === 'paid') return true
  return s.quota.count < s.key.dailyLimit
}

/**
 * Pick the next usable key. Prefers FREE keys that still have room (so free
 * quota is spent before paid keys cost money), most-remaining first; falls back
 * to PAID keys (least-used first to spread load). Returns null if none usable.
 */
export function selectKey(states: KeyState[]): KeyState | null {
  const usable = states.filter(isUsable)
  if (usable.length === 0) return null
  const free = usable.filter((s) => s.key.tier === 'free')
  if (free.length > 0) {
    free.sort(
      (a, b) =>
        b.key.dailyLimit - b.quota.count - (a.key.dailyLimit - a.quota.count)
    )
    return free[0]
  }
  const paid = usable.filter((s) => s.key.tier === 'paid')
  paid.sort((a, b) => a.quota.count - b.quota.count)
  return paid[0]
}

export function hasCapacity(states: KeyState[]): boolean {
  return states.some(isUsable)
}

/** Free-tier used/total today across active, non-banned free keys. */
export function freeTotals(states: KeyState[]): { used: number; total: number } {
  let used = 0
  let total = 0
  for (const s of states) {
    if (!s.key.active || s.key.banned || s.key.tier !== 'free') continue
    total += s.key.dailyLimit
    used += s.quota.exhausted
      ? s.key.dailyLimit
      : Math.min(s.key.dailyLimit, s.quota.count)
  }
  return { used, total }
}

/** Generations on active, non-banned paid keys today (cost). */
export function paidUsed(states: KeyState[]): number {
  return states.reduce(
    (acc, s) =>
      acc + (s.key.active && !s.key.banned && s.key.tier === 'paid' ? s.quota.count : 0),
    0
  )
}

/** Why is there no usable key — used to produce a precise error message. */
export type NoCapacityReason = 'no-active' | 'all-banned' | 'free-exhausted'

export function noCapacityReason(states: KeyState[]): NoCapacityReason {
  const active = states.filter((s) => s.key.active)
  if (active.length === 0) return 'no-active'
  if (active.every((s) => s.key.banned)) return 'all-banned'
  return 'free-exhausted'
}
