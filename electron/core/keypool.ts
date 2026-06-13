import type { ApiKey, KeyQuota } from './types'

export interface KeyState {
  key: ApiKey
  quota: KeyQuota
}

/**
 * Pick the next usable key: active, not exhausted, count below the daily
 * limit. Prefers the key with the most remaining room so usage spreads evenly
 * instead of draining one key at a time.
 */
export function selectKey(states: KeyState[], limit: number): KeyState | null {
  const usable = states.filter(
    (s) => s.key.active && !s.quota.exhausted && s.quota.count < limit
  )
  if (usable.length === 0) return null
  usable.sort((a, b) => limit - b.quota.count - (limit - a.quota.count))
  return usable[0]
}

export function totalRemaining(states: KeyState[], limit: number): number {
  return states.reduce((acc, s) => {
    if (!s.key.active || s.quota.exhausted) return acc
    return acc + Math.max(0, limit - s.quota.count)
  }, 0)
}

export function totalUsed(states: KeyState[], limit: number): number {
  return states.reduce(
    (acc, s) => acc + (s.quota.exhausted ? limit : Math.min(limit, s.quota.count)),
    0
  )
}
