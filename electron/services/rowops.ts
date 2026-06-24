import { randomUUID } from 'crypto'
import { store } from './store'
import type { Row } from '../core/types'

// Row mutations live here (not inline in ipc) so they can be integration-tested.
// Rows carry only text — voice/style/seed live on the project (1 voice/project).
export function makeRow(idx: number, text: string): Row {
  return { id: randomUUID(), idx, text, voice: '', style: '', status: 'pending', updatedAt: Date.now() }
}

export function addRows(projectId: string, texts: string[]): number {
  let n = 0
  store().mutate((d) => {
    const pr = d.projects.find((x) => x.id === projectId)
    if (!pr) return
    const start = pr.rows.length
    pr.rows.push(...texts.map((t, i) => makeRow(start + i, t)))
    pr.rows.forEach((r, i) => (r.idx = i))
    pr.updatedAt = Date.now()
    n = texts.length
  })
  return n
}

/** Duplicate selected rows, inserting each copy right after its source. */
export function duplicateRows(projectId: string, rowIds: string[]): number {
  let n = 0
  store().mutate((d) => {
    const pr = d.projects.find((x) => x.id === projectId)
    if (!pr) return
    const set = new Set(rowIds)
    const next: Row[] = []
    for (const r of pr.rows) {
      next.push(r)
      if (set.has(r.id)) {
        next.push(makeRow(0, r.text))
        n++
      }
    }
    pr.rows = next
    pr.rows.forEach((r, i) => (r.idx = i))
    pr.updatedAt = Date.now()
  })
  return n
}

async function deleteFiles(paths: (string | undefined)[]): Promise<void> {
  const real = paths.filter((p): p is string => !!p)
  if (real.length === 0) return
  const { unlink } = await import('fs/promises')
  for (const f of real) await unlink(f).catch(() => {})
}

/** Remove rows (and their audio files). */
export async function removeRows(projectId: string, rowIds: string[]): Promise<number> {
  const pr = store().projects.find((x) => x.id === projectId)
  if (!pr) return 0
  const set = new Set(rowIds)
  await deleteFiles(pr.rows.filter((r) => set.has(r.id)).map((r) => r.filePath))
  let n = 0
  store().mutate((d) => {
    const proj = d.projects.find((x) => x.id === projectId)
    if (!proj) return
    const before = proj.rows.length
    proj.rows = proj.rows.filter((r) => !set.has(r.id))
    proj.rows.forEach((r, i) => (r.idx = i))
    proj.updatedAt = Date.now()
    n = before - proj.rows.length
  })
  return n
}

export async function removeRow(projectId: string, rowId: string): Promise<void> {
  await removeRows(projectId, [rowId])
}
