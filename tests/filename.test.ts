import { describe, it, expect } from 'vitest'
import { buildFilename, slugify, projectFolderName } from '../electron/core/filename'

describe('slugify', () => {
  it('strips Vietnamese diacritics and lowercases', () => {
    expect(slugify('Ưu đãi tháng 6')).toBe('uu-dai-thang-6')
  })
  it('handles đ/Đ', () => {
    expect(slugify('Đặc biệt')).toBe('dac-biet')
  })
  it('falls back to "audio" when empty', () => {
    expect(slugify('!!!')).toBe('audio')
  })
})

describe('buildFilename', () => {
  const vars = {
    date: '2026-06-13',
    datetime: '2026-06-13_142300',
    project: 'Quảng cáo',
    index: 1,
    voice: 'Kore',
    text: 'Ưu đãi tháng 6'
  }

  it('expands all variables, zero-pads index, compacts date', () => {
    expect(buildFilename('{date}_{project}_{index}_{slug}', vars)).toBe(
      '20260613_Quảng cáo_001_uu-dai-thang-6'
    )
  })

  it('keeps unknown variables literal', () => {
    expect(buildFilename('{voice}_{nope}', vars)).toBe('Kore_{nope}')
  })

  it('strips illegal filename characters', () => {
    expect(buildFilename('a/b:c*{index}', vars)).toBe('abc001')
  })
})

describe('projectFolderName', () => {
  it('joins date and sanitized name', () => {
    expect(projectFolderName('2026-06-13', 'Spot radio')).toBe('2026-06-13_Spot radio')
  })
})
