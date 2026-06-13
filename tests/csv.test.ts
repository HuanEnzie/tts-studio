import { describe, it, expect } from 'vitest'
import { parseDelimited, parseLines, detectDelimiter } from '../electron/core/csv'

describe('parseLines', () => {
  it('keeps non-empty trimmed lines', () => {
    expect(parseLines('  a \n\n b \n')).toEqual(['a', 'b'])
  })
})

describe('detectDelimiter', () => {
  it('detects comma / tab / semicolon', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a\tb')).toBe('\t')
    expect(detectDelimiter('a;b')).toBe(';')
  })
})

describe('parseDelimited', () => {
  it('parses simple rows', () => {
    expect(parseDelimited('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('handles quoted fields with commas and escaped quotes', () => {
    const input = '"hello, world","she said ""hi"""\nx,y'
    expect(parseDelimited(input)).toEqual([
      ['hello, world', 'she said "hi"'],
      ['x', 'y']
    ])
  })

  it('handles CRLF and trailing newline', () => {
    expect(parseDelimited('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('drops fully empty rows', () => {
    expect(parseDelimited('a,b\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })
})
