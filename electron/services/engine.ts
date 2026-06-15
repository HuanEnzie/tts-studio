import { store } from './store'
import { decrypt } from './crypto'
import { synthesize, TtsError } from './gemini'
import { pacificDateString } from '../core/pacific'
import { selectKey, totalRemaining, totalUsed, type KeyState } from '../core/keypool'
import type { KeyQuota, QuotaSummary } from '../core/types'

export class QuotaExhausted extends Error {
  constructor() {
    super('Đã hết quota trên tất cả key cho hôm nay')
    this.name = 'QuotaExhausted'
  }
}

/** Roll over per-key counters when the Pacific day changes. */
function ensureFresh(): void {
  const today = pacificDateString(new Date())
  const s = store()
  s.mutate((d) => {
    for (const k of d.keys) {
      const q = d.quota[k.id]
      if (!q || q.datePt !== today) {
        d.quota[k.id] = { datePt: today, count: 0, exhausted: false }
      }
    }
  })
}

function states(): KeyState[] {
  const s = store()
  return s.keys.map((key) => ({
    key,
    quota: s.quota[key.id] as KeyQuota
  }))
}

export function quotaSummary(): QuotaSummary {
  ensureFresh()
  const s = store()
  const limit = s.settings.dailyLimitPerKey
  const st = states()
  return {
    used: totalUsed(st, limit),
    total: s.keys.filter((k) => k.active).length * limit,
    keys: st.map((x) => ({
      id: x.key.id,
      label: x.key.label,
      account: x.key.account,
      active: x.key.active,
      used: x.quota.exhausted ? limit : Math.min(limit, x.quota.count),
      limit,
      exhausted: x.quota.exhausted
    }))
  }
}

export function remainingToday(): number {
  ensureFresh()
  return totalRemaining(states(), store().settings.dailyLimitPerKey)
}

/**
 * Synthesize one chunk, rotating across keys. On a 429/quota error the key is
 * marked exhausted for the day and the next key is tried. Throws
 * QuotaExhausted when no key has room left.
 */
export async function synthOne(
  text: string,
  voice: string,
  signal?: AbortSignal
): Promise<Buffer> {
  const s = store()
  const model = s.settings.model
  const limit = s.settings.dailyLimitPerKey
  const proxyUrl = s.settings.proxyUrl

  // bounded by the number of keys (each key tried at most once per call)
  for (let attempt = 0; attempt < s.keys.length + 1; attempt++) {
    ensureFresh()
    const picked = selectKey(states(), limit)
    if (!picked) throw new QuotaExhausted()

    let apiKey: string
    try {
      apiKey = decrypt(picked.key.enc)
    } catch {
      // unreadable key — disable it and move on
      s.mutate((d) => {
        const k = d.keys.find((x) => x.id === picked.key.id)
        if (k) k.active = false
      })
      continue
    }

    try {
      const pcm = await synthesize({ text, voice, model, apiKey, proxyUrl, signal })
      s.mutate((d) => {
        d.quota[picked.key.id].count += 1
      })
      return pcm
    } catch (e) {
      if (e instanceof TtsError) {
        if (e.geoBlocked) throw e // location issue — rotating keys won't help
        if (e.forbidden) {
          // project banned by Google — disable this key for good, try the next
          s.mutate((d) => {
            const k = d.keys.find((x) => x.id === picked.key.id)
            if (k) k.active = false
          })
          continue
        }
        if (e.quotaHit) {
          s.mutate((d) => {
            d.quota[picked.key.id].exhausted = true
          })
          continue // try next key
        }
        if (e.retriable && attempt < 2) continue
      }
      throw e
    }
  }
  throw new QuotaExhausted()
}
