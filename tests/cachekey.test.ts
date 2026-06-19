import { describe, it, expect } from 'vitest'
import { contentHash } from '../electron/core/cachekey'

const base = { model: 'm', voice: 'Kore', context: 'c', scene: 's', style: '', text: 'xin chào' }

describe('contentHash', () => {
  it('is deterministic for identical inputs', () => {
    expect(contentHash(base)).toBe(contentHash({ ...base }))
  })
  it('changes when any field changes', () => {
    expect(contentHash(base)).not.toBe(contentHash({ ...base, text: 'khác' }))
    expect(contentHash(base)).not.toBe(contentHash({ ...base, voice: 'Puck' }))
    expect(contentHash(base)).not.toBe(contentHash({ ...base, scene: 'khác' }))
  })
})
