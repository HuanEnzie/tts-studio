// Shared types used by both the main process and the renderer.
// Keep this file free of any `electron` / node-only imports.

export type RowStatus = 'pending' | 'running' | 'done' | 'error'
export type ProjectStatus = 'draft' | 'running' | 'done' | 'partial' | 'error'
export type KeyTier = 'free' | 'tier1' | 'tier2' | 'tier3'

export interface TierLimit {
  rpm: number
  rpd: number | null // null = unlimited per day
  paid: boolean // whether usage on this tier costs money
}

export const TIER_LIMITS: Record<KeyTier, TierLimit> = {
  free: { rpm: 3, rpd: 10, paid: false },
  tier1: { rpm: 10, rpd: 100, paid: true },
  tier2: { rpm: 1000, rpd: 10000, paid: true },
  tier3: { rpm: 1000, rpd: null, paid: true }
}

export const TIER_LABELS: Record<KeyTier, string> = {
  free: 'Free',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3'
}

export interface ApiKey {
  id: string
  label: string
  account: string
  /** base64 of safeStorage-encrypted key material (never the raw key) */
  enc: string
  /** user toggle ONLY — the engine never flips this */
  active: boolean
  /** rate/cost limits come from TIER_LIMITS[tier] */
  tier: KeyTier
  /** set by the engine on a 403 PERMISSION_DENIED; persists until user clears */
  banned: boolean
  /** the exact error text that caused the ban, shown to the user */
  bannedReason?: string
  createdAt: number
}

export interface KeyQuota {
  datePt: string // YYYY-MM-DD in America/Los_Angeles
  count: number
  exhausted: boolean // set when a 429 is seen even if count < limit
}

export interface Row {
  id: string
  idx: number
  text: string
  voice: string
  style: string
  status: RowStatus
  filePath?: string
  error?: string
  /** actual token usage / cost recorded after a successful generation */
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  cached?: boolean
  updatedAt: number
}

export interface ProjectSettings {
  voice: string
  style: string
  /** persona/voice brief, e.g. "giọng nam miền Bắc, truyền cảm" (Context) */
  voiceInstruction: string
  /** situational setting, e.g. "quảng cáo sôi động, kêu gọi mua ngay" (Scene) */
  scene: string
  /** sampling temperature (lower = more consistent across rows) */
  temperature: number
  /** fixed RNG seed — keeps tone consistent across rows in this project */
  seed: number
  format: 'mp3' | 'wav'
  filenameTemplate: string
  /** per-project spend cap in USD (0 = no cap) */
  budgetUsd: number
}

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  outputDir?: string
  settings: ProjectSettings
  rows: Row[]
  createdAt: number
  updatedAt: number
}

export interface DictEntry {
  id: string
  pattern: string
  replacement: string
  enabled: boolean
}

export interface VoicePreset {
  id: string
  name: string
  voice: string
  context: string // -> voiceInstruction
  scene: string
  style: string
  temperature: number
  seed: number
}

export interface AppSettings {
  outputRoot: string
  model: string
  defaultVoice: string
  defaultStyle: string
  /** Default Context brief used by Quick mode and seeded into new projects. */
  voiceInstruction: string
  /** Default Scene used by Quick mode and seeded into new projects. */
  scene: string
  /** default sampling temperature for new projects / Quick */
  temperature: number
  /** default seed for new projects / Quick */
  seed: number
  filenameTemplate: string
  format: 'mp3' | 'wav'
  /** how many rows to generate in parallel */
  concurrency: number
  /** global spend cap per Pacific day in USD (0 = no cap) */
  dailyBudgetUsd: number
  /** reuse a previously generated clip when text+voice+context+scene+style match */
  cacheEnabled: boolean
  /** USD per 1M tokens */
  priceInputPerM: number
  priceAudioPerM: number
  /** abort a single TTS request after this many seconds (prevents hangs) */
  requestTimeoutSec: number
  /** Optional HTTP/HTTPS proxy to route around region blocks */
  proxyUrl: string
}

export interface KeyView {
  id: string
  label: string
  account: string
  active: boolean
  tier: KeyTier
  banned: boolean
  used: number
  limit: number // rpd; 0 = unlimited
  rpm: number
  exhausted: boolean
}

export interface QuotaSummary {
  /** free-tier generations used today across active, non-banned free keys */
  freeUsed: number
  freeTotal: number
  /** generations on paid-tier keys today */
  paidUsed: number
  activeKeys: number
  keys: KeyView[]
}

export interface CostSummary {
  todayUsd: number
  todayInputTokens: number
  todayOutputTokens: number
  dailyBudgetUsd: number
}

export interface BatchEstimate {
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export const VOICES = [
  'Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede',
  'Leda', 'Orus', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
] as const

export const DEFAULT_SETTINGS: AppSettings = {
  outputRoot: '',
  model: 'gemini-3.1-flash-tts-preview',
  defaultVoice: 'Kore',
  defaultStyle: '',
  voiceInstruction: '',
  scene: '',
  temperature: 1,
  seed: 42,
  filenameTemplate: '{date}_{project}_{index}_{slug}',
  format: 'mp3',
  concurrency: 4,
  dailyBudgetUsd: 0,
  cacheEnabled: true,
  priceInputPerM: 0.5,
  priceAudioPerM: 10,
  requestTimeoutSec: 120,
  proxyUrl: ''
}

/** TTS models verified callable via generateContent (ListModels omits some). */
export const TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
] as const

/** Model ids that are truly gone and should be migrated on load (none today). */
export const LEGACY_TTS_MODELS: string[] = []
