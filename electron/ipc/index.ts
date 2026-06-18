import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { randomUUID } from 'crypto'
import { rm } from 'fs/promises'
import { join } from 'path'
import { store } from '../services/store'
import { encrypt, decrypt, maskKey } from '../services/crypto'
import { validateKey, synthesize, TtsError } from '../services/gemini'
import { quotaSummary, hasUsableKey, synthOne } from '../services/engine'
import {
  startBatch,
  stopBatch,
  regenRow,
  batchEvents,
  isRunning
} from '../services/queue'
import { writeAudio } from '../services/audio'
import { pcmToWavBuffer } from '../services/audio'
import { pacificDateString } from '../core/pacific'
import { buildFilename, projectFolderName } from '../core/filename'
import { buildSpokenPrompt } from '../core/prompt'
import { applyDictionary } from '../core/dictionary'
import {
  DEFAULT_SETTINGS,
  type Project,
  type Row,
  type ProjectSettings,
  type DictEntry,
  type KeyTier
} from '../core/types'

type RowInput = { text: string; voice?: string; style?: string }

function makeRow(idx: number, input: RowInput, defaults: ProjectSettings): Row {
  return {
    id: randomUUID(),
    idx,
    text: input.text,
    voice: input.voice || defaults.voice,
    style: input.style || '',
    status: 'pending',
    updatedAt: Date.now()
  }
}

function defaultProjectSettings(): ProjectSettings {
  const s = store().settings
  return {
    voice: s.defaultVoice,
    style: s.defaultStyle,
    voiceInstruction: s.voiceInstruction,
    format: s.format,
    filenameTemplate: s.filenameTemplate
  }
}

// in-memory cache of the most recent Quick-mode audio so Save reuses it
// instead of spending another quota request
const quickCache = new Map<string, Buffer>()

export function registerIpc(): void {
  const broadcast = (channel: string, payload: unknown) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
  }
  batchEvents.on('update', (data) => broadcast('batch:update', data))

  const h = <T>(channel: string, fn: (payload: T) => unknown) =>
    ipcMain.handle(channel, (_e, payload: T) => fn(payload))

  // ---- settings ----
  h('settings:get', () => store().settings)
  h('settings:set', (patch: Partial<typeof DEFAULT_SETTINGS>) => {
    const s = store()
    s.settings = { ...s.settings, ...patch }
    return s.settings
  })

  // ---- keys ----
  h('keys:list', () =>
    store().keys.map((k) => ({
      id: k.id,
      label: k.label,
      account: k.account,
      active: k.active,
      tier: k.tier,
      dailyLimit: k.dailyLimit,
      banned: k.banned,
      bannedReason: k.bannedReason,
      createdAt: k.createdAt
    }))
  )
  h('keys:add', (p: { label: string; account: string; key: string; tier?: KeyTier }) => {
    const s = store()
    const id = randomUUID()
    s.mutate((d) =>
      d.keys.push({
        id,
        label: p.label || maskKey(p.key),
        account: p.account || '',
        enc: encrypt(p.key.trim()),
        active: true,
        tier: p.tier ?? 'free',
        dailyLimit: s.settings.dailyLimitPerKey,
        banned: false,
        createdAt: Date.now()
      })
    )
    return id
  })
  h('keys:addBulk', (p: { text: string; tier?: KeyTier }) => {
    const s = store()
    let added = 0
    const lines = p.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    s.mutate((d) => {
      for (const line of lines) {
        const parts = line.split(',').map((x) => x.trim())
        let label = '', account = '', key = ''
        if (parts.length >= 3) [label, account, key] = parts
        else if (parts.length === 2) [label, key] = parts
        else key = parts[0]
        if (!key) continue
        d.keys.push({
          id: randomUUID(),
          label: label || maskKey(key),
          account,
          enc: encrypt(key),
          active: true,
          tier: p.tier ?? 'free',
          dailyLimit: s.settings.dailyLimitPerKey,
          banned: false,
          createdAt: Date.now()
        })
        added++
      }
    })
    return added
  })
  h('keys:update', (p: { id: string; patch: { label?: string; account?: string; active?: boolean; tier?: KeyTier; dailyLimit?: number; banned?: boolean } }) => {
    store().mutate((d) => {
      const k = d.keys.find((x) => x.id === p.id)
      if (k) {
        Object.assign(k, p.patch)
        if (p.patch.banned === false) k.bannedReason = undefined // clear on un-ban
      }
    })
  })
  h('keys:remove', (p: { id: string }) => {
    store().mutate((d) => {
      d.keys = d.keys.filter((x) => x.id !== p.id)
      delete d.quota[p.id]
    })
  })
  h('keys:validate', async (p: { id: string }) => {
    const k = store().keys.find((x) => x.id === p.id)
    if (!k) return false
    return validateKey(decrypt(k.enc), store().settings.proxyUrl)
  })

  // ---- quota ----
  h('quota:summary', () => quotaSummary())
  h('quota:hasCapacity', () => hasUsableKey())

  // ---- diagnostics ----
  // Full-chain check so we can pinpoint WHERE generation fails:
  // 1) key present  2) auth  3) Gemini TTS call  4) MP3 write (ffmpeg).
  h('diag:test', async () => {
    const s = store()
    const active = s.keys.filter((k) => k.active && !k.banned)
    if (active.length === 0) {
      return { ok: false, stage: 'Key', message: 'Chưa có key đang bật (hoặc tất cả đang bị cấm).' }
    }

    let key: string
    try {
      key = decrypt(active[0].enc)
    } catch {
      return { ok: false, stage: 'Key', message: 'Không giải mã được key trên máy này — hãy xóa và nhập lại key.' }
    }

    // 2) auth
    const authed = await validateKey(key, s.settings.proxyUrl)
    if (!authed) {
      return { ok: false, stage: 'Xác thực', message: 'Key không xác thực được (sai key hoặc mạng chặn).' }
    }

    // 3) Gemini TTS call
    let pcm: Buffer
    try {
      pcm = await synthesize({
        text: 'Xin chào',
        voice: s.settings.defaultVoice,
        model: s.settings.model,
        apiKey: key,
        proxyUrl: s.settings.proxyUrl
      })
    } catch (e) {
      if (e instanceof TtsError) {
        if (e.geoBlocked) return { ok: false, stage: 'Gemini (vùng)', message: e.message }
        if (e.forbidden) return { ok: false, stage: 'Gemini (403)', message: e.message }
        if (e.quotaHit)
          return { ok: false, stage: 'Gemini (quota)', message: 'Key đã hết lượt hôm nay. Thêm key khác hoặc dùng key Paid.' }
      }
      return { ok: false, stage: 'Gemini', message: `Model "${s.settings.model}": ${(e as Error).message}` }
    }

    // 4) MP3 write via bundled ffmpeg (the step that breaks in a packaged app
    //    if ffmpeg isn't unpacked correctly)
    try {
      const { tmpdir } = await import('os')
      const { statSync, rmSync } = await import('fs')
      const tmp = join(tmpdir(), `ttscheck-${randomUUID()}.mp3`)
      await writeAudio(pcm, tmp, 'mp3')
      const size = statSync(tmp).size
      rmSync(tmp, { force: true })
      if (size < 200) return { ok: false, stage: 'Xuất MP3', message: 'Tạo ra file MP3 rỗng (ffmpeg lỗi).' }
    } catch (e) {
      return { ok: false, stage: 'Xuất MP3 (ffmpeg)', message: (e as Error).message }
    }

    return {
      ok: true,
      stage: 'OK',
      message: `Toàn bộ OK: Key → Gemini (${s.settings.model}) → MP3. Tạo được bình thường!`
    }
  })

  // ---- projects ----
  h('projects:list', () =>
    [...store().projects].sort((a, b) => b.updatedAt - a.updatedAt)
  )
  h('projects:get', (p: { id: string }) =>
    store().projects.find((x) => x.id === p.id) ?? null
  )
  h('projects:create', (p: { name: string; rows?: RowInput[] }) => {
    const s = store()
    const settings = defaultProjectSettings()
    const id = randomUUID()
    const project: Project = {
      id,
      name: p.name || 'Dự án không tên',
      status: 'draft',
      settings,
      rows: (p.rows ?? []).map((r, i) => makeRow(i, r, settings)),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    s.mutate((d) => d.projects.push(project))
    return project
  })
  h('projects:duplicate', (p: { id: string }) => {
    const s = store()
    const src = s.projects.find((x) => x.id === p.id)
    if (!src) return null
    const id = randomUUID()
    const copy: Project = {
      ...src,
      id,
      name: `${src.name} (sao chép)`,
      status: 'draft',
      outputDir: undefined,
      rows: src.rows.map((r) => ({
        ...r,
        id: randomUUID(),
        status: 'pending',
        filePath: undefined,
        error: undefined
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    s.mutate((d) => d.projects.push(copy))
    return copy
  })
  h('projects:rename', (p: { id: string; name: string }) => {
    store().mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)
      if (pr) {
        pr.name = p.name
        pr.updatedAt = Date.now()
      }
    })
  })
  h('projects:update', (p: { id: string; settings?: Partial<ProjectSettings> }) => {
    store().mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)
      if (pr && p.settings) {
        pr.settings = { ...pr.settings, ...p.settings }
        pr.updatedAt = Date.now()
      }
    })
  })
  h('projects:remove', async (p: { id: string; deleteFiles?: boolean }) => {
    const s = store()
    const pr = s.projects.find((x) => x.id === p.id)
    if (p.deleteFiles && pr) {
      const date = pacificDateString(new Date())
      const dir =
        pr.outputDir || join(s.settings.outputRoot, projectFolderName(date, pr.name))
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
    s.mutate((d) => {
      d.projects = d.projects.filter((x) => x.id !== p.id)
    })
  })
  h('projects:addRows', (p: { id: string; rows: RowInput[] }) => {
    store().mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)
      if (!pr) return
      const start = pr.rows.length
      pr.rows.push(...p.rows.map((r, i) => makeRow(start + i, r, pr.settings)))
      pr.updatedAt = Date.now()
    })
    return store().projects.find((x) => x.id === p.id) ?? null
  })
  h('projects:updateRow', (p: { id: string; rowId: string; patch: Partial<Row> }) => {
    store().mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)
      const r = pr?.rows.find((x) => x.id === p.rowId)
      if (r) Object.assign(r, p.patch, { updatedAt: Date.now() })
    })
  })
  h('projects:removeRow', (p: { id: string; rowId: string }) => {
    store().mutate((d) => {
      const pr = d.projects.find((x) => x.id === p.id)
      if (pr) {
        pr.rows = pr.rows.filter((x) => x.id !== p.rowId)
        pr.rows.forEach((r, i) => (r.idx = i))
      }
    })
  })

  // ---- batch ----
  h('batch:start', (p: { id: string }) => {
    void startBatch(p.id)
  })
  h('batch:stop', (p: { id: string }) => stopBatch(p.id))
  h('batch:running', (p: { id: string }) => isRunning(p.id))
  h('batch:regenRow', (p: { id: string; rowId: string }) => {
    regenRow(p.id, p.rowId)
  })

  // ---- quick ----
  h('quick:synth', async (p: { text: string; voice: string; style: string; instruction?: string }) => {
    const dictText = applyDictionary(p.text, store().dictionary)
    const text = buildSpokenPrompt({ instruction: p.instruction, style: p.style, text: dictText })
    const pcm = await synthOne(text, p.voice)
    const id = randomUUID()
    quickCache.set(id, pcm)
    // cap cache
    if (quickCache.size > 12) quickCache.delete(quickCache.keys().next().value as string)
    const wav = pcmToWavBuffer(pcm)
    return { id, wavBase64: wav.toString('base64') }
  })
  h('quick:save', async (p: { id: string; suggested: string; format: 'mp3' | 'wav' }) => {
    const pcm = quickCache.get(p.id)
    if (!pcm) throw new Error('Audio đã hết hạn, hãy tạo lại')
    const res = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('music'), `${p.suggested}.${p.format}`),
      filters: [{ name: p.format.toUpperCase(), extensions: [p.format] }]
    })
    if (res.canceled || !res.filePath) return null
    await writeAudio(pcm, res.filePath, p.format)
    return res.filePath
  })

  // ---- dictionary ----
  h('dict:list', () => store().dictionary)
  h('dict:add', (p: { pattern: string; replacement: string }) => {
    const entry: DictEntry = {
      id: randomUUID(),
      pattern: p.pattern,
      replacement: p.replacement,
      enabled: true
    }
    store().mutate((d) => d.dictionary.push(entry))
    return entry
  })
  h('dict:update', (p: { id: string; patch: Partial<DictEntry> }) => {
    store().mutate((d) => {
      const e = d.dictionary.find((x) => x.id === p.id)
      if (e) Object.assign(e, p.patch)
    })
  })
  h('dict:remove', (p: { id: string }) => {
    store().mutate((d) => {
      d.dictionary = d.dictionary.filter((x) => x.id !== p.id)
    })
  })

  // ---- files ----
  h('file:readText', async (p: { path: string }) => {
    const { readFile } = await import('fs/promises')
    return readFile(p.path, 'utf-8')
  })
  h('file:readAudio', async (p: { path: string }) => {
    const { readFile } = await import('fs/promises')
    const buf = await readFile(p.path)
    const mime = p.path.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
    return { base64: buf.toString('base64'), mime }
  })

  // ---- system ----
  h('sys:pickFolder', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return res.canceled ? null : res.filePaths[0]
  })
  h('sys:pickFile', async (p: { filters?: { name: string; extensions: string[] }[] }) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: p?.filters
    })
    return res.canceled ? null : res.filePaths[0]
  })
  h('sys:openPath', (p: { path: string }) => shell.openPath(p.path))
  h('sys:showItem', (p: { path: string }) => shell.showItemInFolder(p.path))
  h('sys:openProjectFolder', async (p: { id: string }) => {
    const s = store()
    const pr = s.projects.find((x) => x.id === p.id)
    if (!pr) return
    const date = pacificDateString(new Date())
    const dir = pr.outputDir || join(s.settings.outputRoot, projectFolderName(date, pr.name))
    const { mkdir } = await import('fs/promises')
    // the folder only exists after generating; create it so opening never fails
    await mkdir(dir, { recursive: true }).catch(() => {})
    return shell.openPath(dir)
  })
}
