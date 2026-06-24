import { app } from 'electron'
import { writeFileSync, readFileSync, existsSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_SETTINGS,
  LEGACY_TTS_MODELS,
  type AppSettings,
  type ApiKey,
  type KeyQuota,
  type Project,
  type DictEntry,
  type VoicePreset
} from '../core/types'

export interface DailySpend {
  datePt: string
  usd: number
  inputTokens: number
  outputTokens: number
}

export interface CacheEntry {
  filePath: string
  inputTokens: number
  outputTokens: number
}

interface DbShape {
  version: number
  settings: AppSettings
  keys: ApiKey[]
  quota: Record<string, KeyQuota>
  projects: Project[]
  dictionary: DictEntry[]
  presets: VoicePreset[]
  cache: Record<string, CacheEntry>
  spend: DailySpend
}

function emptyDb(): DbShape {
  return {
    version: 1,
    settings: {
      ...DEFAULT_SETTINGS,
      outputRoot: join(app.getPath('documents'), 'TTS Studio')
    },
    keys: [],
    quota: {},
    projects: [],
    dictionary: [],
    presets: [],
    cache: {},
    spend: { datePt: '', usd: 0, inputTokens: 0, outputTokens: 0 }
  }
}

class Store {
  private file: string
  private data: DbShape
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    // TTS_DATA_DIR lets tests/harnesses use an isolated store dir
    const dir = process.env['TTS_DATA_DIR'] || app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'data.json')
    this.data = this.load()
  }

  private load(): DbShape {
    if (!existsSync(this.file)) return emptyDb()
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf-8')) as Partial<DbShape>
      const base = emptyDb()
      const data: DbShape = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings ?? {}) }
      }
      // migrate a model id that is no longer available to the verified default
      if (LEGACY_TTS_MODELS.includes(data.settings.model)) {
        data.settings.model = DEFAULT_SETTINGS.model
      }
      // backfill new project-settings fields
      for (const p of data.projects) {
        if (!p.settings) continue
        if (typeof p.settings.voiceInstruction !== 'string') p.settings.voiceInstruction = ''
        if (typeof p.settings.scene !== 'string') p.settings.scene = ''
        if (typeof p.settings.budgetUsd !== 'number') p.settings.budgetUsd = 0
        if (typeof p.settings.temperature !== 'number') p.settings.temperature = data.settings.temperature
        if (typeof p.settings.seed !== 'number') p.settings.seed = data.settings.seed
        if (typeof p.settings.languageCode !== 'string') p.settings.languageCode = data.settings.languageCode
      }
      // backfill preset temperature/seed/languageCode
      for (const pr of data.presets) {
        if (typeof pr.temperature !== 'number') pr.temperature = data.settings.temperature
        if (typeof pr.seed !== 'number') pr.seed = data.settings.seed
        if (typeof pr.languageCode !== 'string') pr.languageCode = data.settings.languageCode
      }
      // migrate keys: old 'free'|'paid' -> tier scheme; backfill banned
      const validTiers = ['free', 'tier1', 'tier2', 'tier3']
      for (const k of data.keys) {
        const t = k.tier as string
        if (t === 'paid') k.tier = 'tier3'
        else if (!validTiers.includes(t)) k.tier = 'free'
        if (typeof k.banned !== 'boolean') k.banned = false
      }
      return data
    } catch {
      // corrupt file — keep a backup, start fresh rather than crashing
      try {
        renameSync(this.file, `${this.file}.bak-${Date.now()}`)
      } catch {
        /* ignore */
      }
      return emptyDb()
    }
  }

  /** Atomic write: tmp file then rename. */
  private flush(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
    renameSync(tmp, this.file)
  }

  /** Debounced persist used after frequent mutations (queue progress, etc). */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 150)
  }

  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.flush()
  }

  get settings(): AppSettings {
    return this.data.settings
  }
  set settings(v: AppSettings) {
    this.data.settings = v
    this.save()
  }

  get keys(): ApiKey[] {
    return this.data.keys
  }
  get quota(): Record<string, KeyQuota> {
    return this.data.quota
  }
  get projects(): Project[] {
    return this.data.projects
  }
  get dictionary(): DictEntry[] {
    return this.data.dictionary
  }
  get presets(): VoicePreset[] {
    return this.data.presets
  }
  get cache(): Record<string, CacheEntry> {
    return this.data.cache
  }
  get spend(): DailySpend {
    return this.data.spend
  }

  mutate(fn: (d: DbShape) => void): void {
    fn(this.data)
    this.save()
  }
}

let instance: Store | null = null
export function store(): Store {
  if (!instance) instance = new Store()
  return instance
}
