import { describe, it, expect } from 'vitest'
import { buildSpokenPrompt } from '../electron/core/prompt'

describe('buildSpokenPrompt', () => {
  it('returns plain text when no directives', () => {
    expect(buildSpokenPrompt({ text: 'Xin chào' })).toBe('Xin chào')
  })

  it('prefixes a single instruction', () => {
    expect(buildSpokenPrompt({ instruction: 'Giọng nam miền Bắc, truyền cảm', text: 'Mua ngay' }))
      .toBe('Giọng nam miền Bắc, truyền cảm: Mua ngay')
  })

  it('joins instruction and style with a period', () => {
    expect(buildSpokenPrompt({ instruction: 'Giọng nam', style: 'đọc nhanh', text: 'Khuyến mãi' }))
      .toBe('Giọng nam. đọc nhanh: Khuyến mãi')
  })

  it('ignores blank directives and trims', () => {
    expect(buildSpokenPrompt({ instruction: '  ', style: 'vui vẻ', text: '  Chào  ' }))
      .toBe('vui vẻ: Chào')
  })
})
