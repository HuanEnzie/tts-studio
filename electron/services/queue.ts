import { EventEmitter } from 'events'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { store } from './store'
import { synthOne, QuotaExhausted, KeysUnavailable } from './engine'
import { writeAudio } from './audio'
import { applyDictionary } from '../core/dictionary'
import { buildSpokenPrompt } from '../core/prompt'
import { buildFilename, projectFolderName } from '../core/filename'
import { pacificDateString } from '../core/pacific'
import type { Project, Row, ProjectStatus } from '../core/types'

export const batchEvents = new EventEmitter()

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
  if (err > 0 && done + err === rows.length) return 'partial'
  return 'partial'
}

function setProjectStatus(projectId: string, status: ProjectStatus): void {
  store().mutate((d) => {
    const p = d.projects.find((x) => x.id === projectId)
    if (p) p.status = status
  })
}

/** Process one row end-to-end; returns the updated row. */
async function processRow(
  project: Project,
  row: Row,
  signal: AbortSignal
): Promise<void> {
  const s = store()
  setRow(project.id, row.id, { status: 'running', error: undefined })
  emit(project.id, { row: { ...row, status: 'running' } })

  const dictText = applyDictionary(row.text, s.dictionary)
  const prompt = buildSpokenPrompt({
    instruction: project.settings.voiceInstruction,
    style: row.style,
    text: dictText
  })
  const pcm = await synthOne(prompt, row.voice || project.settings.voice, signal)

  const dir = outDirFor(project)
  const { date, datetime } = nowStamp()
  const base = buildFilename(project.settings.filenameTemplate, {
    date,
    datetime,
    project: project.name,
    index: row.idx + 1,
    voice: row.voice || project.settings.voice,
    text: row.text
  })
  const ext = project.settings.format
  const outPath = join(dir, `${base}.${ext}`)
  await writeAudio(pcm, outPath, ext)

  const updated = setRow(project.id, row.id, { status: 'done', filePath: outPath })
  emit(project.id, { row: updated })
}

export async function startBatch(projectId: string): Promise<void> {
  if (active.has(projectId)) return
  const abort = new AbortController()
  active.set(projectId, { abort })

  const s = store()
  setProjectStatus(projectId, 'running')
  emit(projectId, { status: 'running' })

  try {
    // re-read rows each iteration so selective edits are respected
    while (!abort.signal.aborted) {
      const project = s.projects.find((p) => p.id === projectId)
      if (!project) break
      const next = project.rows.find((r) => r.status === 'pending' || r.status === 'error')
      if (!next) break

      try {
        await processRow(project, next, abort.signal)
      } catch (e) {
        if (e instanceof QuotaExhausted) {
          // leave the row pending; resume tomorrow after reset
          emit(projectId, { quotaExhausted: true })
          break
        }
        if (e instanceof KeysUnavailable) {
          // no active/usable key — waiting won't help; stop and report
          emit(projectId, { blocked: (e as Error).message })
          break
        }
        if (abort.signal.aborted) break
        const updated = setRow(projectId, next.id, {
          status: 'error',
          error: (e as Error).message
        })
        emit(projectId, { row: updated })
      }
    }
  } finally {
    active.delete(projectId)
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
