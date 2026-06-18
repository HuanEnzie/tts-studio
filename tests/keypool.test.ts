import { describe, it, expect } from 'vitest'
import {
  selectKey,
  hasCapacity,
  freeTotals,
  paidUsed,
  noCapacityReason,
  selectScheduled,
  type KeyState
} from '../electron/core/keypool'
import type { ApiKey } from '../electron/core/types'

function key(id: string, over: Partial<ApiKey> = {}): ApiKey {
  return {
    id, label: id, account: '', enc: '',
    active: true, tier: 'free', dailyLimit: 10, banned: false, createdAt: 0,
    ...over
  }
}
function state(id: string, count: number, overKey: Partial<ApiKey> = {}, exhausted = false): KeyState {
  return { key: key(id, overKey), quota: { datePt: '2026-06-13', count, exhausted } }
}

describe('selectKey', () => {
  it('returns null when nothing is usable', () => {
    expect(selectKey([state('a', 10)], )).toBeNull() // free, at limit
    expect(selectKey([state('a', 0, { active: false })])).toBeNull()
    expect(selectKey([state('a', 0, { banned: true })])).toBeNull()
    expect(selectKey([state('a', 0, {}, true)])).toBeNull() // exhausted
  })

  it('prefers the free key with the most remaining room', () => {
    const picked = selectKey([state('a', 8), state('b', 2), state('c', 5)])
    expect(picked?.key.id).toBe('b')
  })

  it('uses free keys before paid keys', () => {
    const picked = selectKey([state('p', 100, { tier: 'paid' }), state('f', 9)])
    expect(picked?.key.id).toBe('f')
  })

  it('falls back to paid (least-used) when no free room', () => {
    const picked = selectKey([
      state('f', 10), // free exhausted by count
      state('p1', 50, { tier: 'paid' }),
      state('p2', 20, { tier: 'paid' })
    ])
    expect(picked?.key.id).toBe('p2')
  })

  it('paid keys are never capped', () => {
    expect(selectKey([state('p', 9999, { tier: 'paid' })])?.key.id).toBe('p')
  })
})

describe('totals', () => {
  const states = [
    state('a', 3),
    state('b', 10),
    state('c', 0, { banned: true }),
    state('p', 42, { tier: 'paid' })
  ]

  it('free totals ignore banned and paid keys', () => {
    // a: 3/10, b: 10/10 ; c banned, p paid -> excluded
    expect(freeTotals(states)).toEqual({ used: 13, total: 20 })
  })

  it('paid used counts only active non-banned paid keys', () => {
    expect(paidUsed(states)).toBe(42)
  })

  it('hasCapacity true while a free key has room', () => {
    expect(hasCapacity(states)).toBe(true)
  })
})

describe('selectScheduled (RPM throttle)', () => {
  const interval = 20_000 // 3 RPM -> 20s between calls on a free key
  const minInterval = () => interval

  it('picks a ready key with no wait', () => {
    const r = selectScheduled([state('a', 0)], 100_000, () => 0, minInterval)
    expect(r?.key.key.id).toBe('a')
    expect(r?.waitMs).toBe(0)
  })

  it('prefers a cool key over one used recently', () => {
    const now = 100_000
    const last = (id: string) => (id === 'a' ? now - 1000 : 0) // a used 1s ago, b idle
    const r = selectScheduled([state('a', 0), state('b', 0)], now, last, minInterval)
    expect(r?.key.key.id).toBe('b')
    expect(r?.waitMs).toBe(0)
  })

  it('returns the wait time when every key is still cooling down', () => {
    const now = 100_000
    const last = () => now - 5000 // used 5s ago, needs 20s -> wait 15s
    const r = selectScheduled([state('a', 0)], now, last, minInterval)
    expect(r?.waitMs).toBe(15_000)
  })

  it('null when nothing usable', () => {
    expect(selectScheduled([state('a', 10)], 0, () => 0, minInterval)).toBeNull()
  })
})

describe('noCapacityReason', () => {
  it('no-active when nothing is enabled', () => {
    expect(noCapacityReason([state('a', 0, { active: false })])).toBe('no-active')
  })
  it('all-banned when every active key is banned', () => {
    expect(noCapacityReason([state('a', 0, { banned: true })])).toBe('all-banned')
  })
  it('free-exhausted otherwise', () => {
    expect(noCapacityReason([state('a', 10)])).toBe('free-exhausted')
  })
})
