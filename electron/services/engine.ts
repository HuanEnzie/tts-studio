import { store } from './store'
import { decrypt } from './crypto'
import { synthesize, TtsError } from './gemini'
import { pacificDateString } from '../core/pacific'
import {
  hasCapacity,
  freeTotals,
  paidUsed,
  noCapacityReason,
  selectScheduled,
  type KeyState
} from '../core/keypool'
import { costUsd } from '../core/pricing'
import {
  TIER_LIMITS,
  type ApiKey,
  type KeyQuota,
  type QuotaSummary,
  type CostSummary
} from '../core/types'

// per-key last-dispatch time (epoch ms) for RPM throttling, in-memory per session
const lastCallAt = new Map<string, number>()

function minIntervalMs(key: ApiKey): number {
  const rpm = TIER_LIMITS[key.tier].rpm
  return Math.ceil(60_000 / Math.max(1, rpm))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      },
      { once: true }
    )
  })
}

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
    keys: st.map((x) => {
      const lim = TIER_LIMITS[x.key.tier]
      const cap = lim.rpd
      return {
        id: x.key.id,
        label: x.key.label,
        account: x.key.account,
        active: x.key.active,
        tier: x.key.tier,
        banned: x.key.banned,
        used:
          cap === null
            ? x.quota.count
            : x.quota.exhausted
              ? cap
              : Math.min(cap, x.quota.count),
        limit: cap ?? 0,
        rpm: lim.rpm,
        exhausted: x.quota.exhausted
      }
    })
  }
}

export function hasUsableKey(): boolean {
  ensureFresh()
  return hasCapacity(states())
}

/** Reset the global daily spend counter when the Pacific day changes. */
function freshSpend(): void {
  const today = pacificDateString(new Date())
  const s = store()
  if (s.spend.datePt !== today) {
    s.mutate((d) => {
      d.spend = { datePt: today, usd: 0, inputTokens: 0, outputTokens: 0 }
    })
  }
}

/** Record usage after a successful generation. Returns the USD cost (0 if free). */
export function recordSpend(inputTokens: number, outputTokens: number, paid: boolean): number {
  freshSpend()
  if (!paid) return 0
  const s = store()
  const cost = costUsd(
    inputTokens,
    outputTokens,
    s.settings.priceInputPerM,
    s.settings.priceAudioPerM
  )
  s.mutate((d) => {
    d.spend.usd += cost
    d.spend.inputTokens += inputTokens
    d.spend.outputTokens += outputTokens
  })
  return cost
}

export function rowCostUsd(inputTokens: number, outputTokens: number): number {
  const s = store()
  return costUsd(inputTokens, outputTokens, s.settings.priceInputPerM, s.settings.priceAudioPerM)
}

export function costSummary(): CostSummary {
  freshSpend()
  const s = store()
  return {
    todayUsd: s.spend.usd,
    todayInputTokens: s.spend.inputTokens,
    todayOutputTokens: s.spend.outputTokens,
    dailyBudgetUsd: s.settings.dailyBudgetUsd
  }
}

export function spendTodayUsd(): number {
  freshSpend()
  return store().spend.usd
}

function banKey(id: string, reason: string): void {
  store().mutate((d) => {
    const k = d.keys.find((x) => x.id === id)
    if (k) {
      k.banned = true
      k.bannedReason = reason
    }
  })
}

function capacityError(): Error {
  const reason = noCapacityReason(states())
  if (reason === 'no-active') return new KeysUnavailable('Chưa có API key nào đang bật.')
  if (reason === 'all-banned') {
    // surface the real Google error(s) so the user knows WHY, not just "banned"
    const reasons = Array.from(
      new Set(
        store()
          .keys.filter((k) => k.active && k.banned && k.bannedReason)
          .map((k) => k.bannedReason as string)
      )
    )
    const detail = reasons.length ? ` Lý do: ${reasons.join(' | ')}` : ''
    return new KeysUnavailable(`Tất cả key đang bật đều bị Google từ chối (403).${detail}`)
  }
  return new QuotaExhausted()
}

/**
 * Synthesize one chunk, rotating across keys (free first, then paid). 429 marks
 * the key exhausted for the day; 403 bans it (engine never touches `active`).
 */
export interface SynthOneResult {
  pcm: Buffer
  inputTokens: number
  outputTokens: number
  paid: boolean
}

export async function synthOne(
  text: string,
  voice: string,
  signal?: AbortSignal
): Promise<SynthOneResult> {
  const s = store()
  const model = s.settings.model
  const proxyUrl = s.settings.proxyUrl
  const timeoutMs = (s.settings.requestTimeoutSec || 120) * 1000

  for (let attempt = 0; attempt < s.keys.length + 1; attempt++) {
    ensureFresh()
    const sched = selectScheduled(
      states(),
      Date.now(),
      (id) => lastCallAt.get(id) ?? 0,
      (key) => minIntervalMs(key)
    )
    if (!sched) throw capacityError()
    if (sched.waitMs > 0) await sleep(sched.waitMs, signal) // respect per-key RPM
    const picked = sched.key
    lastCallAt.set(picked.key.id, Date.now())

    let apiKey: string
    try {
      apiKey = decrypt(picked.key.enc)
    } catch {
      banKey(picked.key.id, 'Không giải mã được key trên máy này (key được mã hóa theo từng máy).')
      continue
    }

    try {
      const r = await synthesize({ text, voice, model, apiKey, proxyUrl, timeoutMs, signal })
      s.mutate((d) => {
        d.quota[picked.key.id].count += 1
      })
      return {
        pcm: r.pcm,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        paid: TIER_LIMITS[picked.key.tier].paid
      }
    } catch (e) {
      if (e instanceof TtsError) {
        if (e.geoBlocked) throw e // location issue — rotating keys won't help
        if (e.forbidden) {
          banKey(picked.key.id, e.message)
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
