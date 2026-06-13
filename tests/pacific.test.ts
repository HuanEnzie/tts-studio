import { describe, it, expect } from 'vitest'
import { pacificDateString, msUntilPacificMidnight } from '../electron/core/pacific'

describe('pacific', () => {
  it('formats a Pacific date as YYYY-MM-DD', () => {
    // 2026-06-13 12:00 UTC -> still 2026-06-13 in LA (UTC-7 in summer)
    const d = new Date('2026-06-13T12:00:00Z')
    expect(pacificDateString(d)).toBe('2026-06-13')
  })

  it('rolls to previous day for early UTC hours', () => {
    // 2026-06-13 05:00 UTC -> 2026-06-12 22:00 in LA
    const d = new Date('2026-06-13T05:00:00Z')
    expect(pacificDateString(d)).toBe('2026-06-12')
  })

  it('returns ms until midnight within a day', () => {
    const d = new Date('2026-06-13T12:00:00Z')
    const ms = msUntilPacificMidnight(d)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(86_400_000)
  })
})
