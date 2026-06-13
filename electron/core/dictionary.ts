import type { DictEntry } from './types'

// Apply pronunciation replacements before sending text to TTS. Whole-word,
// case-insensitive, longest-pattern-first so "TP.HCM" wins over "TP".
export function applyDictionary(text: string, entries: DictEntry[]): string {
  const active = entries
    .filter((e) => e.enabled && e.pattern.trim() !== '')
    .sort((a, b) => b.pattern.length - a.pattern.length)

  let out = text
  for (const e of active) {
    const escaped = e.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // boundaries that work for unicode-ish tokens; avoid mid-word matches
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'giu')
    out = out.replace(re, (_m, pre) => `${pre}${e.replacement}`)
  }
  return out
}
