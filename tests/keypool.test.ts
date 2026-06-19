import { describe, it, expect } from 'vitest'
import {
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
    active: true, tier: 'free', banned: false, createdAt: 0,
    ...over
  }
}
function state(id: string, count: number, overKey: Partial<ApiKey> = {}, exhausted = false): KeyState {
  return { key: key(id, overKey), quota: { datePt: '2026-06-13', count, exhausted } }
}

const interval = () => 20_000 // 3 RPM
const last0 = () => 0

describe('selectScheduled', () => {
  it('null when nothing usable', () => {
    expect(selectScheduled([state('a', 10)], 0, last0, interval)).toBeNull() // free at rpd cap 10
    expect(selectScheduled([state('a', 0, { active: false })], 0, last0, interval)).toBeNull()
    expect(selectScheduled([state('a', 0, { banned: true })], 0, last0, interval)).toBeNull()
  })

  it('prefers free keys before paid (tier3)', () => {
    const r = selectScheduled([state('p', 999, { tier: 'tier3' }), state('f', 5)], 1e6, last0, interval)
    expect(r?.key.key.id).toBe('f')
  })

  it('tier3 is uncapped per day', () => {
    const r = selectScheduled([state('p', 99999, { tier: 'tier3' })], 1e6, last0, interval)
    expect(r?.key.key.id).toBe('p')
  })

  it('prefers a cool key and reports wait when all cooling', () => {
    const now = 100_000
    const lastRecent = () => now - 5000 // used 5s ago, needs 20s -> wait 15s
    const r = selectScheduled([state('a', 0)], now, lastRecent, interval)
    expect(r?.waitMs).toBe(15_000)
  })
})

describe('totals', () => {
  const states = [
    state('a', 3),                       // free 3/10
    state('b', 10),                      // free 10/10
    state('c', 0, { banned: true }),     // banned -> excluded
    state('p', 42, { tier: 'tier3' })    // paid
  ]
  it('free totals: only active non-banned free keys (rpd 10 each)', () => {
    expect(freeTotals(states)).toEqual({ used: 13, total: 20 })
  })
  it('paid used counts paid-tier keys', () => {
    expect(paidUsed(states)).toBe(42)
  })
  it('hasCapacity true while a free key has room', () => {
    expect(hasCapacity(states)).toBe(true)
  })
})

describe('noCapacityReason', () => {
  it('no-active', () => expect(noCapacityReason([state('a', 0, { active: false })])).toBe('no-active'))
  it('all-banned', () => expect(noCapacityReason([state('a', 0, { banned: true })])).toBe('all-banned'))
  it('free-exhausted', () => expect(noCapacityReason([state('a', 10)])).toBe('free-exhausted'))
})
