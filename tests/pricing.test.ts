import { describe, it, expect } from 'vitest'
import { costUsd, estimateTokens, estimateBatch } from '../electron/core/pricing'

describe('costUsd', () => {
  it('input $0.5/M + audio $10/M', () => {
    // 25 input + 209 audio (from a real call) -> ~0.00210
    expect(costUsd(25, 209, 0.5, 10)).toBeCloseTo(25 / 1e6 * 0.5 + 209 / 1e6 * 10, 10)
  })
  it('zero tokens -> $0', () => {
    expect(costUsd(0, 0, 0.5, 10)).toBe(0)
  })
})

describe('estimateTokens', () => {
  it('scales with text length and output > input', () => {
    const e = estimateTokens('a'.repeat(100))
    expect(e.output).toBeGreaterThan(e.input)
    expect(e.input).toBeGreaterThan(0)
  })
})

describe('estimateBatch', () => {
  it('sums tokens and cost across texts', () => {
    const r = estimateBatch(['xin chào', 'mua ngay'], 0.5, 10)
    expect(r.requests).toBe(2)
    expect(r.costUsd).toBeGreaterThan(0)
    expect(r.outputTokens).toBeGreaterThan(0)
  })
})
