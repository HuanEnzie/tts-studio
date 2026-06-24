import { EventEmitter } from 'events'
import { mkdirSync, existsSync } from 'fs'
import { copyFile } from 'fs/promises'
import { join } from 'path'
import { store } from './store'
import {
  synthOne,
  recordSpend,
  rowCostUsd,
  spendTodayUsd,
  QuotaExhausted,
  KeysUnavailable
} from './engine'
import { writeAudio } from './audio'
import { applyDictionary } from '../core/dictionary'
import { buildSpokenPrompt } from '../core/prompt'
import { estimateTokens } from '../core/pricing'
import { contentHash } from '../core/cachekey'
import { buildFilename, projectFolderName } from '../core/filename'
import { pacificDateString } from '../core/pacific'
import type { Project, Row, ProjectStatus } from '../core/types'

export const batchEvents = new EventEmitter()

/** Stops a run because a spend cap would be exceeded — not retriable by waiting. */
export class BudgetExceeded extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceeded'
  }
}

interface RunHandle {
  abort: AbortController
}
const active = new Map<string, RunHandle>()

export function isRunning(projectId: string): boolean {
  return active.has(projectId)
}

function emit(projectId: string, payload: unknown): void {
  batchEvents.emit('update', { projectId, ...(payload as object) })
}

function nowStamp(): { date: string; datetime: string } {
  const date = pacificDateString(new Date())
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${date}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return { date, datetime }
}

function outDirFor(project: Project): string {
  const s = store()
  const date = pacificDateString(new Date())
  const dir =
    project.outputDir || join(s.settings.outputRoot, projectFolderName(date, project.name))
  mkdirSync(dir, { recursive: true })
  return dir
}

function setRow(projectId: string, rowId: string, patch: Partial<Row>): Row | undefined {
  const s = store()
  let updated: Row | undefined
  s.mutate((d) => {
    const p = d.projects.find((x) => x.id === projectId)
    const r = p?.rows.find((x) => x.id === rowId)
    if (r) {
      Object.assign(r, patch, { updatedAt: Date.now() })
      updated = r
      if (p) p.updatedAt = Date.now()
    }
  })
  return updated
}

function computeStatus(rows: Row[]): ProjectStatus {
  if (rows.length === 0) return 'draft'
  const done = rows.filter((r) => r.status === 'done').length
  const err = rows.filter((r) => r.status === 'error').length
  if (done === rows.length) return 'done'
  if (done === 0 && err === 0) return 'draft'
  return 'partial'
}

function setProjectStatus(projectId: string, status: ProjectStatus): void {
  store().mutate((d) => {
    const p = d.projects.find((x) => x.id === projectId)
    if (p) p.status = status
  })
}

function projectSpentUsd(projectId: string): number {
  const p = store().projects.find((x) => x.id === projectId)
  if (!p) return 0
  return p.rows.reduce((acc, r) => acc + (r.costUsd ?? 0), 0)
}

/** Process one row end-to-end (cache → budget → synth → write → record). */
async function processRow(project: Project, row: Row, signal: AbortSignal): Promise<void> {
  const s = store()
  setRow(project.id, row.id, { status: 'running', error: undefined })
  emit(project.id, { row: { ...row, status: 'running' } })

  const dictText = applyDictionary(row.text, s.dictionary)
  const context = project.settings.voiceInstruction
  const scene = project.settings.scene
  const style = row.style
  const voice = row.voice || project.settings.voice
  const model = s.settings.model
  const ext = project.settings.format

  const dir = outDirFor(project)
  const { date, datetime } = nowStamp()
  const base = buildFilename(project.settings.filenameTemplate, {
    date,
    datetime,
    project: project.name,
    index: row.idx + 1,
    voice,
    text: row.text
  })
  const outPath = join(dir, `${base}.${ext}`)
  const temperature = project.settings.temperature
  const seed = project.settings.seed
  const hash = contentHash({ model, voice, context, scene, style, text: dictText, temperature, seed })

  // cache: reuse a prior identical clip instead of paying again
  if (s.settings.cacheEnabled) {
    const c = s.cache[hash]
    if (c && existsSync(c.filePath)) {
      if (c.filePath !== outPath) await copyFile(c.filePath, outPath).catch(() => {})
      const updated = setRow(project.id, row.id, {
        status: 'done',
        filePath: existsSync(outPath) ? outPath : c.filePath,
        cached: true,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0
      })
      emit(project.id, { row: updated })
      return
    }
  }

  // budget pre-check using an estimate (real cost recorded after)
  const est = estimateTokens(dictText)
  const estCost = rowCostUsd(est.input, est.output)
  if (project.settings.budgetUsd > 0 && projectSpentUsd(project.id) + estCost > project.settings.budgetUsd) {
    throw new BudgetExceeded(`Đã chạm trần ngân sách dự án ($${project.settings.budgetUsd}).`)
  }
  if (s.settings.dailyBudgetUsd > 0 && spendTodayUsd() + estCost > s.settings.dailyBudgetUsd) {
    throw new BudgetExceeded(`Đã chạm trần chi tiêu hôm nay ($${s.settings.dailyBudgetUsd}).`)
  }

  const prompt = buildSpokenPrompt({ instruction: context, scene, style, text: dictText })
  const r = await synthOne(prompt, voice, { temperature, seed, signal })
  await writeAudio(r.pcm, outPath, ext)
  const cost = recordSpend(r.inputTokens, r.outputTokens, r.paid)

  s.mutate((d) => {
    d.cache[hash] = {
      filePath: outPath,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens
    }
  })
  const updated = setRow(project.id, row.id, {
    status: 'done',
    filePath: outPath,
    cached: false,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costUsd: cost
  })
  emit(project.id, { row: updated })
}

export async function startBatch(projectId: string): Promise<void> {
  if (active.has(projectId)) return
  const abort = new AbortController()
  active.set(projectId, { abort })
  setProjectStatus(projectId, 'running')
  emit(projectId, { status: 'running' })

  const claimed = new Set<string>()
  const ctl: { stop: { kind: 'quota' | 'blocked'; message?: string } | null } = { stop: null }

  const claimNext = (): Row | null => {
    const project = store().projects.find((p) => p.id === projectId)
    if (!project) return null
    const r = project.rows.find(
      (x) => (x.status === 'pending' || x.status === 'error') && !claimed.has(x.id)
    )
    if (!r) return null
    claimed.add(r.id)
    return { ...r }
  }

  const worker = async (): Promise<void> => {
    while (!abort.signal.aborted && !ctl.stop) {
      const row = claimNext()
      if (!row) break
      const project = store().projects.find((p) => p.id === projectId)
      if (!project) break
      try {
        await processRow(project, row, abort.signal)
      } catch (e) {
        if (e instanceof QuotaExhausted) {
          ctl.stop = { kind: 'quota' }
          setRow(projectId, row.id, { status: 'pending' })
          break
        }
        if (e instanceof KeysUnavailable || e instanceof BudgetExceeded) {
          ctl.stop = { kind: 'blocked', message: (e as Error).message }
          setRow(projectId, row.id, { status: 'pending' })
          break
        }
        if (abort.signal.aborted) {
          setRow(projectId, row.id, { status: 'pending' })
          break
        }
        const updated = setRow(projectId, row.id, { status: 'error', error: (e as Error).message })
        emit(projectId, { row: updated })
      }
    }
  }

  const n = Math.max(1, Math.min(store().settings.concurrency || 1, 16))
  try {
    await Promise.all(Array.from({ length: n }, () => worker()))
  } finally {
    active.delete(projectId)
    if (ctl.stop?.kind === 'quota') emit(projectId, { quotaExhausted: true })
    if (ctl.stop?.kind === 'blocked') emit(projectId, { blocked: ctl.stop.message })
    const project = store().projects.find((p) => p.id === projectId)
    const status = project ? computeStatus(project.rows) : 'draft'
    setProjectStatus(projectId, status)
    store().saveNow()
    emit(projectId, { status, finished: true })
  }
}

export function stopBatch(projectId: string): void {
  const h = active.get(projectId)
  if (h) h.abort.abort()
}

/** Reset a single row to pending so it will be re-generated on the next run. */
export function regenRow(projectId: string, rowId: string): void {
  setRow(projectId, rowId, { status: 'pending', error: undefined, filePath: undefined })
}

/** Reset every errored row to pending (for a "retry all failed" action). */
export function retryFailed(projectId: string): number {
  const p = store().projects.find((x) => x.id === projectId)
  if (!p) return 0
  let n = 0
  for (const r of p.rows) {
    if (r.status === 'error') {
      setRow(projectId, r.id, { status: 'pending', error: undefined })
      n++
    }
  }
  return n
}
