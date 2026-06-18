// Shared types used by both the main process and the renderer.
// Keep this file free of any `electron` / node-only imports.

export type RowStatus = 'pending' | 'running' | 'done' | 'error'
export type ProjectStatus = 'draft' | 'running' | 'done' | 'partial' | 'error'
export type KeyTier = 'free' | 'paid'

export interface ApiKey {
  id: string
  label: string
  account: string
  /** base64 of safeStorage-encrypted key material (never the raw key) */
  enc: string
  /** user toggle ONLY — the engine never flips this */
  active: boolean
  /** 'free' = capped at dailyLimit/day; 'paid' = no daily cap, usage = cost */
  tier: KeyTier
  /** daily free-tier cap (ignored for paid keys) */
  dailyLimit: number
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
  updatedAt: number
}

export interface ProjectSettings {
  voice: string
  style: string
  /** Free-text delivery brief applied to every row, e.g. "giọng nam miền Bắc,
   * truyền cảm, phù hợp video TVC". Steers tone/accent/pace of the chosen voice. */
  voiceInstruction: string
  format: 'mp3' | 'wav'
  filenameTemplate: string
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

export interface AppSettings {
  outputRoot: string
  model: string
  defaultVoice: string
  defaultStyle: string
  /** Default delivery brief used by Quick mode and seeded into new projects. */
  voiceInstruction: string
  filenameTemplate: string
  dailyLimitPerKey: number
  format: 'mp3' | 'wav'
  /** Optional HTTP/HTTPS proxy (e.g. http://user:pass@host:port) to route
   * Gemini calls through a supported region when the local IP is geo-blocked. */
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
  limit: number // free: daily cap; paid: 0 (unlimited)
  exhausted: boolean
}

export interface QuotaSummary {
  /** free-tier generations used today across active, non-banned free keys */
  freeUsed: number
  /** total free-tier capacity today (sum of free keys' daily limits) */
  freeTotal: number
  /** generations on paid keys today (counted as cost, never capped) */
  paidUsed: number
  /** active, non-banned keys */
  activeKeys: number
  keys: KeyView[]
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
  filenameTemplate: '{date}_{project}_{index}_{slug}',
  dailyLimitPerKey: 10,
  format: 'mp3',
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
