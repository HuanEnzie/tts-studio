import { store } from './store'
import { decrypt } from './crypto'
import { synthesize, TtsError } from './gemini'
import { pacificDateString } from '../core/pacific'
import {
  selectKey,
  hasCapacity,
  freeTotals,
  paidUsed,
  noCapacityReason,
  type KeyState
} from '../core/keypool'
import type { KeyQuota, QuotaSummary } from '../core/types'

/** Free quota used up for today — batch can resume after the Pacific reset. */
export class QuotaExhausted extends Error {
  constructor() {
    super('Đã hết lượt free trên các key hôm nay (chưa có key Paid còn dùng được).')
    this.name = 'QuotaExhausted'
  }
}

/** No usable key for a reason waiting won't fix (none active / all banned). */
export class KeysUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeysUnavailable'
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
  return s.keys.map((key) => ({ key, quota: s.quota[key.id] as KeyQuota }))
}

export function quotaSummary(): QuotaSummary {
  ensureFresh()
  const s = store()
  const st = states()
  const ft = freeTotals(st)
  return {
    freeUsed: ft.used,
    freeTotal: ft.total,
    paidUsed: paidUsed(st),
    activeKeys: s.keys.filter((k) => k.active && !k.banned).length,
    keys: st.map((x) => ({
      id: x.key.id,
      label: x.key.label,
      account: x.key.account,
      active: x.key.active,
      tier: x.key.tier,
      banned: x.key.banned,
      used:
        x.key.tier === 'paid'
          ? x.quota.count
          : x.quota.exhausted
            ? x.key.dailyLimit
            : Math.min(x.key.dailyLimit, x.quota.count),
      limit: x.key.tier === 'paid' ? 0 : x.key.dailyLimit,
      exhausted: x.quota.exhausted
    }))
  }
}

export function hasUsableKey(): boolean {
  ensureFresh()
  return hasCapacity(states())
}

function banKey(id: string): void {
  store().mutate((d) => {
    const k = d.keys.find((x) => x.id === id)
    if (k) k.banned = true
  })
}

function capacityError(): Error {
  const reason = noCapacityReason(states())
  if (reason === 'no-active') return new KeysUnavailable('Chưa có API key nào đang bật.')
  if (reason === 'all-banned')
    return new KeysUnavailable('Tất cả key đang bật đều bị cấm (403). Bỏ cấm hoặc thêm key khác.')
  return new QuotaExhausted()
}

/**
 * Synthesize one chunk, rotating across keys (free first, then paid). 429 marks
 * the key exhausted for the day; 403 bans it (engine never touches `active`).
 */
export async function synthOne(
  text: string,
  voice: string,
  signal?: AbortSignal
): Promise<Buffer> {
  const s = store()
  const model = s.settings.model
  const proxyUrl = s.settings.proxyUrl

  for (let attempt = 0; attempt < s.keys.length + 1; attempt++) {
    ensureFresh()
    const picked = selectKey(states())
    if (!picked) throw capacityError()

    let apiKey: string
    try {
      apiKey = decrypt(picked.key.enc)
    } catch {
      banKey(picked.key.id) // undecryptable here — skip and surface it
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
          banKey(picked.key.id)
          continue
        }
        if (e.quotaHit) {
          s.mutate((d) => {
            d.quota[picked.key.id].exhausted = true
          })
          continue
        }
        if (e.retriable && attempt < 2) continue
      }
      throw e
    }
  }
  throw capacityError()
}
