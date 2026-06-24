import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Play, Square, FolderInput, Plus, Upload, RefreshCw,
  Trash2, Volume2, Loader2, ListRestart, DollarSign, Bookmark, Mic, Settings2, Copy
} from 'lucide-react'
import { Button } from '../design/Button'
import { Badge, type Status } from '../design/Badge'
import { Modal } from '../design/Modal'
import { Field, Input, Textarea } from '../design/Input'
import { EmptyState } from '../design/EmptyState'
import { AudioPlayer } from '../components/AudioPlayer'
import { ProjectConfigFields } from '../components/ProjectConfigFields'
import { ipc } from '../lib/ipc'
import { useProjects } from '../store/projects'
import { useNav } from '../store/nav'
import { useQuota } from '../store/quota'
import { toast } from '../store/toast'
import { type Row, type RowStatus, type VoicePreset, type BatchEstimate, type ProjectSettings } from '@shared/types'

const rowStatus: Record<RowStatus, Status> = {
  pending: 'pending', running: 'running', done: 'done', error: 'error'
}

export function ProjectDetail() {
  const projectId = useNav((s) => s.projectId)
  const go = useNav((s) => s.go)
  const { current, loadProject, refreshList } = useProjects()
  const refreshQuota = useQuota((s) => s.refresh)
  const [running, setRunning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [presets, setPresets] = useState<VoicePreset[]>([])
  const [confirmEst, setConfirmEst] = useState<BatchEstimate | null>(null)
  const [pendingAction, setPendingAction] = useState<{ run: () => Promise<void> } | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [draft, setDraft] = useState<ProjectSettings | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null)

  useEffect(() => {
    if (projectId) loadProject(projectId)
    ipc.presets.list().then(setPresets)
    setSelected(new Set())
  }, [projectId, loadProject])

  useEffect(() => {
    if (projectId) ipc.batch.running(projectId).then(setRunning)
  }, [projectId, current?.status])

  if (!current) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  const p = current
  const cfg = p.settings
  const done = p.rows.filter((r) => r.status === 'done').length
  const total = p.rows.length
  const pending = p.rows.filter((r) => r.status === 'pending' || r.status === 'error').length
  const errorCount = p.rows.filter((r) => r.status === 'error').length
  const projectCost = p.rows.reduce((a, r) => a + (r.costUsd ?? 0), 0)

  const selectedIds = p.rows.filter((r) => selected.has(r.id)).map((r) => r.id)
  const allSelected = total > 0 && selectedIds.length === total
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(p.rows.map((r) => r.id)))

  // estimate -> confirm -> run (the action is stored and executed on confirm)
  const askRun = async (rowIds: string[] | undefined, run: () => Promise<void>) => {
    const est = await ipc.batch.estimate(p.id, rowIds)
    if (est.requests === 0) { toast.info('Không có dòng nào để tạo'); return }
    setPendingAction({ run }); setConfirmEst(est)
  }
  const confirmRun = async () => {
    const a = pendingAction
    setConfirmEst(null); setPendingAction(null); setRunning(true)
    if (a) await a.run()
  }
  const stop = async () => { await ipc.batch.stop(p.id); setRunning(false) }

  const runPending = () => askRun(undefined, async () => { await ipc.batch.start(p.id) })
  const runAll = () => askRun(p.rows.map((r) => r.id), async () => {
    await ipc.batch.resetAll(p.id); await loadProject(p.id); await ipc.batch.start(p.id)
  })
  const runSelected = () => askRun(selectedIds, async () => {
    await ipc.batch.regenRows(p.id, selectedIds); await loadProject(p.id); await ipc.batch.start(p.id, selectedIds)
  })
  const retryFailed = async () => { const n = await ipc.batch.retryFailed(p.id); await loadProject(p.id); if (n > 0) runPending() }
  const duplicateSelected = async () => {
    const n = selectedIds.length
    try {
      await ipc.projects.duplicateRows(p.id, selectedIds)
      await loadProject(p.id); setSelected(new Set())
      toast.success(`Đã nhân bản ${n} dòng`)
    } catch (e) { toast.error('Nhân bản lỗi: ' + (e as Error).message) }
  }
  const doDelete = async () => {
    const cd = confirmDelete
    setConfirmDelete(null)
    if (!cd) return
    try {
      await ipc.projects.removeRows(p.id, cd.ids)
      await loadProject(p.id); setSelected(new Set())
      toast.success('Đã xóa')
    } catch (e) { toast.error('Xóa lỗi: ' + (e as Error).message) }
  }
  const saveTextInline = async (rowId: string, text: string) => {
    await ipc.projects.updateRow(p.id, rowId, { text, status: 'pending', filePath: undefined })
    await loadProject(p.id)
  }

  const saveConfig = async () => {
    if (draft) { await ipc.projects.update(p.id, draft); await loadProject(p.id) }
    setConfigOpen(false)
    toast.success('Đã lưu cấu hình giọng')
  }
  const saveToLibrary = async () => {
    await ipc.presets.add({
      name: `${cfg.voice} · seed ${cfg.seed}`, voice: cfg.voice, context: cfg.voiceInstruction,
      scene: cfg.scene, style: cfg.style, languageCode: cfg.languageCode,
      temperature: cfg.temperature, seed: cfg.seed
    })
    setPresets(await ipc.presets.list())
    toast.success('Đã lưu giọng vào thư viện')
  }

  const regen = async (row: Row) => {
    await ipc.batch.regenRows(p.id, [row.id]); await loadProject(p.id)
    if (!running) await ipc.batch.start(p.id, [row.id])
  }
  const removeRow = async (row: Row) => { await ipc.projects.removeRow(p.id, row.id); loadProject(p.id) }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-7 py-4">
        <button onClick={() => { go('projects'); refreshList() }} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">{p.name}</h1>
            <Badge status={running ? 'running' : rowStatus[total && done === total ? 'done' : 'pending']} label={running ? 'Đang chạy' : `${done}/${total}`} />
          </div>
        </div>
        {projectCost > 0 && (
          <span className="tnum flex items-center gap-1 text-xs text-ink-muted" title="Chi phí dự án"><DollarSign className="h-3.5 w-3.5" />{projectCost.toFixed(4)}</span>
        )}
        <Button variant="ghost" icon={<FolderInput className="h-4 w-4" />} onClick={() => ipc.sys.openProjectFolder(p.id)}>Folder</Button>
        {!running && errorCount > 0 && (
          <Button variant="ghost" icon={<ListRestart className="h-4 w-4" />} onClick={retryFailed}>Lỗi ({errorCount})</Button>
        )}
        {!running && total > 0 && (
          <Button variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={runAll}>Tạo lại tất cả</Button>
        )}
        {running ? (
          <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={stop}>Dừng</Button>
        ) : (
          <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={runPending}>Tạo {pending > 0 ? `(${pending})` : ''}</Button>
        )}
      </div>

      {/* slim config toolbar */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-surface/40 px-7 py-2.5">
        <button
          onClick={() => { setDraft({ ...cfg }); setConfigOpen(true) }}
          className="no-drag flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left transition hover:border-border-strong"
        >
          <Mic className="h-4 w-4 shrink-0 text-accent-to" />
          <span className="truncate text-sm text-ink">{cfg.voice}</span>
          <span className="tnum hidden shrink-0 text-xs text-ink-faint sm:inline">· {cfg.languageCode} · seed {cfg.seed} · t{cfg.temperature}</span>
          {(cfg.voiceInstruction || cfg.style) && <span className="hidden truncate text-xs text-ink-faint lg:inline">· {[cfg.style, cfg.voiceInstruction].filter(Boolean).join(' · ')}</span>}
          <Settings2 className="ml-1 h-3.5 w-3.5 shrink-0 text-ink-faint" />
        </button>
        <Button variant="ghost" icon={<Bookmark className="h-4 w-4" />} onClick={saveToLibrary}>Lưu vào thư viện</Button>
        <div className="flex-1" />
        <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Thêm dòng</Button>
      </div>

      {/* rows */}
      <div className="flex min-h-0 flex-1 flex-col px-7 py-4">
        {total === 0 ? (
          <EmptyState icon={Plus} title="Chưa có dòng nào" hint="Bấm vào chip giọng để cấu hình, rồi Thêm dòng để dán nội dung." action={<Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Thêm dòng</Button>} />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#7C5CFF]" />
                Chọn tất cả
              </label>
              <div className="flex-1" />
              {selectedIds.length > 0 ? (
                <>
                  <span className="mr-1 text-xs text-ink-faint">{selectedIds.length} đã chọn</span>
                  {!running && <Button size="sm" variant="primary" icon={<Play className="h-3.5 w-3.5" />} onClick={runSelected}>Chạy ({selectedIds.length})</Button>}
                  <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={duplicateSelected}>Nhân bản</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete({ ids: selectedIds, label: `${selectedIds.length} dòng đã chọn` })}>Xóa ({selectedIds.length})</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="text-status-error" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete({ ids: p.rows.map((r) => r.id), label: `tất cả ${total} dòng` })}>Xóa tất cả</Button>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {p.rows.map((r) => (
                <RowItem key={r.id} row={r} selected={selected.has(r.id)} onToggle={() => toggleSel(r.id)} onRegen={() => regen(r)} onSaveText={(t) => saveTextInline(r.id, t)} onRemove={() => removeRow(r)} />
              ))}
            </div>
          </>
        )}
      </div>

      <ImportModal open={importing} onClose={() => setImporting(false)} onImport={async (rows) => {
        await ipc.projects.addRows(p.id, rows)
        await loadProject(p.id)
        setImporting(false)
        toast.success(`Đã thêm ${rows.length} dòng`)
      }} />

      <Modal open={!!confirmEst} onClose={() => { setConfirmEst(null); setPendingAction(null) }} title="Xác nhận tạo"
        footer={<><Button variant="ghost" onClick={() => { setConfirmEst(null); setPendingAction(null) }}>Hủy</Button><Button variant="primary" onClick={confirmRun}>Tạo {confirmEst?.requests} dòng</Button></>}>
        {confirmEst && (
          <div className="flex flex-col gap-2 text-sm text-ink-muted">
            <div className="flex justify-between"><span>Số dòng cần tạo</span><span className="tnum text-ink">{confirmEst.requests}</span></div>
            <div className="flex justify-between"><span>Token (ước tính)</span><span className="tnum text-ink">{confirmEst.inputTokens.toLocaleString()} in · {confirmEst.outputTokens.toLocaleString()} audio</span></div>
            <div className="flex justify-between"><span>Chi phí ước tính (key Paid)</span><span className="tnum font-semibold text-ink">${confirmEst.costUsd.toFixed(4)}</span></div>
            <p className="mt-1 text-xs text-ink-faint">Key Free miễn phí.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Xóa dòng"
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Hủy</Button><Button variant="danger" onClick={doDelete}>Xóa</Button></>}>
        <p className="text-sm text-ink-muted">Xóa <span className="font-medium text-ink">{confirmDelete?.label}</span> và các file âm thanh tương ứng? Hành động không thể hoàn tác.</p>
      </Modal>

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Cấu hình giọng đọc" width={560}
        footer={<><Button variant="ghost" onClick={() => setConfigOpen(false)}>Hủy</Button><Button variant="primary" onClick={saveConfig}>Lưu</Button></>}>
        {draft && <ProjectConfigFields value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} presets={presets} />}
      </Modal>

      <QuotaSync trigger={done} onSync={refreshQuota} />
    </div>
  )
}

function QuotaSync({ trigger, onSync }: { trigger: number; onSync: () => void }) {
  useEffect(() => { onSync() }, [trigger, onSync])
  return null
}

function RowItem({ row, selected, onToggle, onRegen, onSaveText, onRemove }: { row: Row; selected: boolean; onToggle: () => void; onRegen: () => void; onSaveText: (text: string) => void; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.text)

  const play = async () => {
    if (src || !row.filePath) return
    setLoading(true)
    try {
      const { base64, mime } = await ipc.file.readAudio(row.filePath)
      setSrc(`data:${mime};base64,${base64}`)
    } catch { toast.error('Không đọc được file audio') } finally { setLoading(false) }
  }
  const startEdit = () => { setDraft(row.text); setEditing(true) }
  const commit = () => { setEditing(false); if (draft.trim() && draft !== row.text) onSaveText(draft.trim()) }

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={'rounded-xl border bg-surface px-4 py-3 ' + (selected ? 'border-accent-from/40' : 'border-border')}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0 accent-[#7C5CFF]" />
        <span className="tnum w-7 shrink-0 text-xs text-ink-faint">{String(row.idx + 1).padStart(2, '0')}</span>
        <Badge status={rowStatus[row.status]} />
        {editing ? (
          <textarea
            value={draft}
            autoFocus
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } if (e.key === 'Escape') setEditing(false) }}
            className="min-w-0 flex-1 resize-none rounded-lg border border-accent-from/50 bg-surface px-2 py-1 text-sm text-ink outline-none ring-2 ring-accent-from/20"
          />
        ) : (
          <p onClick={startEdit} title="Bấm để sửa" className="min-w-0 flex-1 cursor-text truncate text-sm text-ink hover:text-white">{row.text}</p>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {row.status === 'done' && row.filePath && (
            <button onClick={play} title="Nghe" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onRegen} title="Tạo lại dòng này" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onRemove} title="Xóa (xóa cả file)" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-status-error"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <AnimatePresence>
        {src && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3"><AudioPlayer src={src} autoPlay /></div>
          </motion.div>
        )}
      </AnimatePresence>
      {row.error && <p className="mt-2 text-xs text-status-error">{row.error}</p>}
    </motion.div>
  )
}

function ImportModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (rows: { text: string }[]) => void }) {
  const [text, setText] = useState('')
  const [sep, setSep] = useState('###')

  useEffect(() => {
    if (open) {
      setText('')
      ipc.settings.get().then((s) => setSep(s.lineSeparator || '###'))
    }
  }, [open])

  const loadFile = async () => {
    const path = await ipc.sys.pickFile([{ name: 'Text', extensions: ['txt', 'csv', 'md'] }])
    if (!path) return
    const content = await ipc.file.readText(path).catch(() => '')
    if (content) setText(content)
  }

  const rows = useMemo(() => {
    const parts = sep.trim() ? text.split(sep) : text.split(/\r?\n/)
    return parts.map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }))
  }, [text, sep])

  const doImport = () => {
    ipc.settings.set({ lineSeparator: sep })
    onImport(rows)
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm dòng" width={580}
      footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" disabled={rows.length === 0} onClick={doImport}>Thêm {rows.length} dòng</Button></>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <div className="w-40">
            <Field label="Ký tự tách dòng" hint="Để trống = tách theo xuống dòng">
              <Input value={sep} onChange={(e) => setSep(e.target.value)} placeholder="###" />
            </Field>
          </div>
          <Button size="md" variant="ghost" onClick={loadFile}>Chọn file…</Button>
          <div className="flex-1" />
          <span className="pb-2.5 text-xs text-ink-faint">{rows.length} dòng</span>
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-56 font-mono text-[13px]" placeholder={'Nội dung dòng 1 (có thể nhiều câu)\n###\nNội dung dòng 2\n###\nNội dung dòng 3'} />
        <p className="text-xs text-ink-faint">Mỗi dự án dùng 1 giọng (cấu hình ở trên). Mỗi đoạn cách nhau bằng "{sep || 'xuống dòng'}" sẽ thành 1 dòng.</p>
      </div>
    </Modal>
  )
}
