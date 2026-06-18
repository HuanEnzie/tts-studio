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
  type DictEntry
} from '../core/types'

interface DbShape {
  version: number
  settings: AppSettings
  keys: ApiKey[]
  quota: Record<string, KeyQuota>
  projects: Project[]
  dictionary: DictEntry[]
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
    dictionary: []
  }
}

class Store {
  private file: string
  private data: DbShape
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    const dir = app.getPath('userData')
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
      // backfill voiceInstruction for projects created before the field existed
      for (const p of data.projects) {
        if (p.settings && typeof p.settings.voiceInstruction !== 'string') {
          p.settings.voiceInstruction = ''
        }
      }
      // backfill per-key tier/limit/banned for keys created before these existed
      for (const k of data.keys) {
        if (k.tier !== 'free' && k.tier !== 'paid') k.tier = 'free'
        if (typeof k.dailyLimit !== 'number') k.dailyLimit = data.settings.dailyLimitPerKey
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
