import { TIER_LIMITS, type ApiKey, type KeyQuota } from './types'

export interface KeyState {
  key: ApiKey
  quota: KeyQuota
}

function rpd(key: ApiKey): number | null {
  return TIER_LIMITS[key.tier].rpd
}

function isUsable(s: KeyState): boolean {
  if (!s.key.active || s.key.banned || s.quota.exhausted) return false
  const cap = rpd(s.key)
  return cap === null || s.quota.count < cap
}

export function hasCapacity(states: KeyState[]): boolean {
  return states.some(isUsable)
}

/**
 * RPM-aware pick. Free keys are preferred (cost), then within the chosen tier
 * the key that becomes available soonest (respecting its per-key rate limit).
 * Returns the key plus how long to wait before calling it (0 = ready now).
 */
export function selectScheduled(
  states: KeyState[],
  now: number,
  lastCallOf: (id: string) => number,
  minIntervalOf: (key: ApiKey) => number
): { key: KeyState; waitMs: number } | null {
  const usable = states.filter(isUsable)
  if (usable.length === 0) return null
  const free = usable.filter((s) => s.key.tier === 'free')
  const group = free.length > 0 ? free : usable.filter((s) => s.key.tier !== 'free')

  const remaining = (s: KeyState): number => {
    const cap = rpd(s.key)
    return cap === null ? Number.MAX_SAFE_INTEGER : cap - s.quota.count
  }

  const ranked = group
    .map((s) => ({ s, readyAt: lastCallOf(s.key.id) + minIntervalOf(s.key) }))
    .sort((a, b) => {
      if (a.readyAt !== b.readyAt) return a.readyAt - b.readyAt
      return remaining(b.s) - remaining(a.s)
    })

  const top = ranked[0]
  return { key: top.s, waitMs: Math.max(0, top.readyAt - now) }
}

/** Free-tier used/total today across active, non-banned free keys. */
export function freeTotals(states: KeyState[]): { used: number; total: number } {
  let used = 0
  let total = 0
  for (const s of states) {
    if (!s.key.active || s.key.banned || s.key.tier !== 'free') continue
    const cap = TIER_LIMITS.free.rpd ?? 0
    total += cap
    used += s.quota.exhausted ? cap : Math.min(cap, s.quota.count)
  }
  return { used, total }
}

/** Generations on active, non-banned paid-tier keys today (cost). */
export function paidUsed(states: KeyState[]): number {
  return states.reduce(
    (acc, s) =>
      acc +
      (s.key.active && !s.key.banned && TIER_LIMITS[s.key.tier].paid ? s.quota.count : 0),
    0
  )
}

export type NoCapacityReason = 'no-active' | 'all-banned' | 'free-exhausted'

export function noCapacityReason(states: KeyState[]): NoCapacityReason {
  const active = states.filter((s) => s.key.active)
  if (active.length === 0) return 'no-active'
  if (active.every((s) => s.key.banned)) return 'all-banned'
  return 'free-exhausted'
}
