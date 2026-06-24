import type {
  AppSettings,
  Project,
  Row,
  ProjectSettings,
  DictEntry,
  QuotaSummary,
  CostSummary,
  BatchEstimate,
  VoicePreset,
  KeyTier
} from '@shared/types'

const inv = <T = unknown>(c: string, p?: unknown) => window.api.invoke<T>(c, p)

export interface KeyMeta {
  id: string
  label: string
  account: string
  active: boolean
  tier: KeyTier
  banned: boolean
  bannedReason?: string
  createdAt: number
}

export interface BatchUpdate {
  projectId: string
  row?: Row
  status?: Project['status']
  finished?: boolean
  quotaExhausted?: boolean
  blocked?: string
}

type RowInput = { text: string; voice?: string; style?: string }

export const ipc = {
  settings: {
    get: () => inv<AppSettings>('settings:get'),
    set: (patch: Partial<AppSettings>) => inv<AppSettings>('settings:set', patch)
  },
  keys: {
    list: () => inv<KeyMeta[]>('keys:list'),
    add: (label: string, account: string, key: string, tier: KeyTier) =>
      inv<string>('keys:add', { label, account, key, tier }),
    addBulk: (text: string, tier: KeyTier) => inv<number>('keys:addBulk', { text, tier }),
    update: (
      id: string,
      patch: Partial<Pick<KeyMeta, 'label' | 'account' | 'active' | 'tier' | 'banned'>>
    ) => inv('keys:update', { id, patch }),
    remove: (id: string) => inv('keys:remove', { id }),
    validate: (id: string) => inv<boolean>('keys:validate', { id })
  },
  quota: {
    summary: () => inv<QuotaSummary>('quota:summary'),
    hasCapacity: () => inv<boolean>('quota:hasCapacity')
  },
  cost: {
    summary: () => inv<CostSummary>('cost:summary')
  },
  presets: {
    list: () => inv<VoicePreset[]>('presets:list'),
    add: (p: Omit<VoicePreset, 'id'>) => inv<VoicePreset>('presets:add', p),
    update: (id: string, patch: Partial<VoicePreset>) => inv('presets:update', { id, patch }),
    remove: (id: string) => inv('presets:remove', { id }),
    apply: (id: string, projectId: string) =>
      inv<Project | null>('presets:apply', { id, projectId })
  },
  diag: {
    test: () =>
      inv<{ ok: boolean; stage: string; message: string }>('diag:test')
  },
  projects: {
    list: () => inv<Project[]>('projects:list'),
    get: (id: string) => inv<Project | null>('projects:get', { id }),
    create: (name: string, rows?: RowInput[]) =>
      inv<Project>('projects:create', { name, rows }),
    duplicate: (id: string) => inv<Project | null>('projects:duplicate', { id }),
    rename: (id: string, name: string) => inv('projects:rename', { id, name }),
    update: (id: string, settings: Partial<ProjectSettings>) =>
      inv('projects:update', { id, settings }),
    remove: (id: string, deleteFiles: boolean) =>
      inv('projects:remove', { id, deleteFiles }),
    addRows: (id: string, rows: RowInput[]) =>
      inv<Project | null>('projects:addRows', { id, rows }),
    updateRow: (id: string, rowId: string, patch: Partial<Row>) =>
      inv('projects:updateRow', { id, rowId, patch }),
    removeRow: (id: string, rowId: string) => inv('projects:removeRow', { id, rowId }),
    duplicateRows: (id: string, rowIds: string[]) =>
      inv<Project | null>('projects:duplicateRows', { id, rowIds }),
    removeRows: (id: string, rowIds: string[]) =>
      inv<Project | null>('projects:removeRows', { id, rowIds })
  },
  batch: {
    start: (id: string, rowIds?: string[]) => inv('batch:start', { id, rowIds }),
    stop: (id: string) => inv('batch:stop', { id }),
    running: (id: string) => inv<boolean>('batch:running', { id }),
    regenRow: (id: string, rowId: string) => inv('batch:regenRow', { id, rowId }),
    regenRows: (id: string, rowIds: string[]) => inv('batch:regenRows', { id, rowIds }),
    resetAll: (id: string) => inv<number>('batch:resetAll', { id }),
    retryFailed: (id: string) => inv<number>('batch:retryFailed', { id }),
    estimate: (id: string, rowIds?: string[]) => inv<BatchEstimate>('batch:estimate', { id, rowIds }),
    onUpdate: (cb: (u: BatchUpdate) => void) =>
      window.api.on('batch:update', (u) => cb(u as BatchUpdate))
  },
  quick: {
    synth: (text: string, voice: string, style: string, instruction: string, scene: string, temperature: number, seed: number) =>
      inv<{ id: string; wavBase64: string; costUsd: number }>('quick:synth', { text, voice, style, instruction, scene, temperature, seed }),
    save: (id: string, suggested: string, format: 'mp3' | 'wav') =>
      inv<string | null>('quick:save', { id, suggested, format })
  },
  dict: {
    list: () => inv<DictEntry[]>('dict:list'),
    add: (pattern: string, replacement: string) =>
      inv<DictEntry>('dict:add', { pattern, replacement }),
    update: (id: string, patch: Partial<DictEntry>) => inv('dict:update', { id, patch }),
    remove: (id: string) => inv('dict:remove', { id })
  },
  file: {
    readText: (path: string) => inv<string>('file:readText', { path }),
    readAudio: (path: string) =>
      inv<{ base64: string; mime: string }>('file:readAudio', { path })
  },
  sys: {
    pickFolder: () => inv<string | null>('sys:pickFolder'),
    pickFile: (filters?: { name: string; extensions: string[] }[]) =>
      inv<string | null>('sys:pickFile', { filters }),
    openPath: (path: string) => inv('sys:openPath', { path }),
    showItem: (path: string) => inv('sys:showItem', { path }),
    openProjectFolder: (id: string) => inv('sys:openProjectFolder', { id })
  }
}
