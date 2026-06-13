import { describe, it, expect } from 'vitest'
import { applyDictionary } from '../electron/core/dictionary'
import type { DictEntry } from '../electron/core/types'

const e = (pattern: string, replacement: string, enabled = true): DictEntry => ({
  id: pattern,
  pattern,
  replacement,
  enabled
})

describe('applyDictionary', () => {
  it('replaces whole-word, case-insensitive', () => {
    expect(applyDictionary('Mua iPhone ngay', [e('iphone', 'ai phôn')])).toBe('Mua ai phôn ngay')
  })

  it('does not replace inside other words', () => {
    expect(applyDictionary('tpbank', [e('tp', 'thành phố')])).toBe('tpbank')
  })

  it('prefers the longest pattern first', () => {
    const dict = [e('TP', 'thành phố'), e('TP.HCM', 'thành phố Hồ Chí Minh')]
    expect(applyDictionary('Ở TP.HCM hôm nay', dict)).toBe('Ở thành phố Hồ Chí Minh hôm nay')
  })

  it('skips disabled entries', () => {
    expect(applyDictionary('abc', [e('abc', 'xyz', false)])).toBe('abc')
  })
})
