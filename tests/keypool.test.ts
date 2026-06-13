import { describe, it, expect } from 'vitest'
import { selectKey, totalRemaining, totalUsed, type KeyState } from '../electron/core/keypool'
import type { ApiKey } from '../electron/core/types'

const key = (id: string, active = true): ApiKey => ({
  id, label: id, account: '', enc: '', active, createdAt: 0
})
const state = (id: string, count: number, opts: { active?: boolean; exhausted?: boolean } = {}): KeyState => ({
  key: key(id, opts.active ?? true),
  quota: { datePt: '2026-06-13', count, exhausted: opts.exhausted ?? false }
})

describe('selectKey', () => {
  const LIMIT = 10

  it('returns null when nothing is usable', () => {
    expect(selectKey([state('a', 10)], LIMIT)).toBeNull()
    expect(selectKey([state('a', 0, { active: false })], LIMIT)).toBeNull()
    expect(selectKey([state('a', 0, { exhausted: true })], LIMIT)).toBeNull()
  })

  it('prefers the key with the most remaining room (load spreading)', () => {
    const picked = selectKey([state('a', 8), state('b', 2), state('c', 5)], LIMIT)
    expect(picked?.key.id).toBe('b')
  })
})

describe('totals', () => {
  const LIMIT = 10
  const states = [state('a', 3), state('b', 10), state('c', 0, { exhausted: true })]

  it('counts remaining across active, non-exhausted keys', () => {
    // a: 7 left, b: 0 left, c: exhausted -> 0
    expect(totalRemaining(states, LIMIT)).toBe(7)
  })

  it('counts used, treating exhausted as full', () => {
    // a: 3, b: 10, c: exhausted -> 10
    expect(totalUsed(states, LIMIT)).toBe(23)
  })
})
