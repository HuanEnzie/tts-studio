import { app } from 'electron'
import { writeFileSync, readFileSync, existsSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_SETTINGS,
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
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings ?? {}) }
      }
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
