// Shared types used by both the main process and the renderer.
// Keep this file free of any `electron` / node-only imports.

export type RowStatus = 'pending' | 'running' | 'done' | 'error'
export type ProjectStatus = 'draft' | 'running' | 'done' | 'partial' | 'error'

export interface ApiKey {
  id: string
  label: string
  account: string
  /** base64 of safeStorage-encrypted key material (never the raw key) */
  enc: string
  active: boolean
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
  filenameTemplate: string
  dailyLimitPerKey: number
  format: 'mp3' | 'wav'
}

export interface KeyView {
  id: string
  label: string
  account: string
  active: boolean
  used: number
  limit: number
  exhausted: boolean
}

export interface QuotaSummary {
  used: number
  total: number
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
  filenameTemplate: '{date}_{project}_{index}_{slug}',
  dailyLimitPerKey: 10,
  format: 'mp3'
}
