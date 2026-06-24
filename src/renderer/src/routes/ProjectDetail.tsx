import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Play, Square, FolderInput, Plus, Upload, RefreshCw,
  Pencil, Trash2, Volume2, Loader2, ListRestart, DollarSign, Bookmark
} from 'lucide-react'
import { Button } from '../design/Button'
import { Badge, type Status } from '../design/Badge'
import { Modal } from '../design/Modal'
import { Field, Input, Textarea, Select } from '../design/Input'
import { EmptyState } from '../design/EmptyState'
import { AudioPlayer } from '../components/AudioPlayer'
import { ipc } from '../lib/ipc'
import { useProjects } from '../store/projects'
import { useNav } from '../store/nav'
import { useQuota } from '../store/quota'
import { toast } from '../store/toast'
import { parseLines, parseDelimited } from '@shared/csv'
import { buildFilename } from '@shared/filename'
import { VOICES, type Row, type RowStatus, type VoicePreset, type BatchEstimate } from '@shared/types'

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
  const [editing, setEditing] = useState<Row | null>(null)
  const [presets, setPresets] = useState<VoicePreset[]>([])
  const [confirmEst, setConfirmEst] = useState<BatchEstimate | null>(null)

  useEffect(() => {
    if (projectId) loadProject(projectId)
    ipc.presets.list().then(setPresets)
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
  const done = p.rows.filter((r) => r.status === 'done').length
  const total = p.rows.length
  const pending = p.rows.filter((r) => r.status === 'pending' || r.status === 'error').length

  const errorCount = p.rows.filter((r) => r.status === 'error').length
  const projectCost = p.rows.reduce((a, r) => a + (r.costUsd ?? 0), 0)

  // estimate first, then confirm, then run
  const askStart = async () => {
    if (pending === 0) { toast.info('Không còn dòng nào cần tạo'); return }
    const est = await ipc.batch.estimate(p.id)
    setConfirmEst(est)
  }
  const start = async () => {
    setConfirmEst(null)
    setRunning(true)
    await ipc.batch.start(p.id)
  }
  const stop = async () => { await ipc.batch.stop(p.id); setRunning(false) }

  const retryFailed = async () => {
    const n = await ipc.batch.retryFailed(p.id)
    await loadProject(p.id)
    if (n > 0) askStart()
  }

  const applyPreset = async (id: string) => {
    if (!id) return
    await ipc.presets.apply(id, p.id)
    await loadProject(p.id)
    toast.success('Đã áp giọng từ thư viện')
  }

  const saveToLibrary = async () => {
    await ipc.presets.add({
      name: `${p.settings.voice} · seed ${p.settings.seed}`,
      voice: p.settings.voice,
      context: p.settings.voiceInstruction,
      scene: p.settings.scene,
      style: p.settings.style,
      temperature: p.settings.temperature,
      seed: p.settings.seed
    })
    setPresets(await ipc.presets.list())
    toast.success('Đã lưu giọng vào thư viện')
  }

  const update = async (settings: Partial<typeof p.settings>) => {
    await ipc.projects.update(p.id, settings)
    loadProject(p.id)
  }

  const regen = async (row: Row) => {
    await ipc.batch.regenRow(p.id, row.id)
    await loadProject(p.id)
    if (!running) start()
  }

  const removeRow = async (row: Row) => {
    await ipc.projects.removeRow(p.id, row.id)
    loadProject(p.id)
  }

  const filenamePreview = buildFilename(p.settings.filenameTemplate, {
    date: '2026-06-13', datetime: '2026-06-13_142300',
    project: p.name, index: 1, voice: p.settings.voice, text: p.rows[0]?.text ?? 'mẫu văn bản'
  }) + '.' + p.settings.format

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
          <span className="tnum flex items-center gap-1 text-xs text-ink-muted" title="Chi phí dự án">
            <DollarSign className="h-3.5 w-3.5" />{projectCost.toFixed(4)}
          </span>
        )}
        <Button variant="ghost" icon={<FolderInput className="h-4 w-4" />} onClick={() => ipc.sys.openProjectFolder(p.id)}>Folder</Button>
        {!running && errorCount > 0 && (
          <Button variant="secondary" icon={<ListRestart className="h-4 w-4" />} onClick={retryFailed}>Tạo lại lỗi ({errorCount})</Button>
        )}
        {running ? (
          <Button variant="danger" icon={<Square className="h-4 w-4" />} onClick={stop}>Dừng</Button>
        ) : (
          <Button variant="primary" icon={<Play className="h-4 w-4" />} onClick={askStart}>
            Tạo {pending > 0 ? `(${pending})` : ''}
          </Button>
        )}
      </div>

      {/* settings strip */}
      <div className="flex flex-col gap-3 border-b border-border/60 bg-surface/40 px-7 py-3">
        <div className="flex flex-wrap items-end gap-4">
        <div className="w-40">
          <Field label="Giọng mặc định">
            <Select value={p.settings.voice} onChange={(e) => update({ voice: e.target.value })}>
              {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
        </div>
        <div className="w-28">
          <Field label="Định dạng">
            <Select value={p.settings.format} onChange={(e) => update({ format: e.target.value as 'mp3' | 'wav' })}>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </Select>
          </Field>
        </div>
        <div className="w-28">
          <Field label="Temperature" hint="Thấp = ổn định">
            <Input type="number" step="0.1" min="0" max="2" value={p.settings.temperature} onChange={(e) => update({ temperature: Math.max(0, Math.min(2, Number(e.target.value))) })} />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Seed (giữ tông)">
            <div className="flex gap-1">
              <Input type="number" value={p.settings.seed} onChange={(e) => update({ seed: Math.floor(Number(e.target.value) || 0) })} className="flex-1" />
              <button title="Đổi seed ngẫu nhiên" onClick={() => update({ seed: Math.floor(Math.random() * 1e9) })} className="shrink-0 rounded-xl border border-border bg-surface px-2 text-sm text-ink-muted transition hover:text-ink">🎲</button>
            </div>
          </Field>
        </div>
        <div className="w-28">
          <Field label="Trần $ dự án" hint="0 = không">
            <Input type="number" step="0.1" value={p.settings.budgetUsd} onChange={(e) => update({ budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
        </div>
        <div className="min-w-[200px] flex-1">
          <Field label="Mẫu tên file" hint={<span className="text-ink-faint">Ví dụ: <span className="text-ink-muted">{filenamePreview}</span></span>}>
            <Input value={p.settings.filenameTemplate} onChange={(e) => update({ filenameTemplate: e.target.value })} />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Giọng từ thư viện">
            <Select value="" onChange={(e) => applyPreset(e.target.value)}>
              <option value="">{presets.length ? '— chọn giọng —' : '(thư viện trống)'}</option>
              {presets.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </Select>
          </Field>
        </div>
        <Button variant="ghost" icon={<Bookmark className="h-4 w-4" />} onClick={saveToLibrary}>Lưu giọng</Button>
        <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Thêm dòng</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Context — mô tả giọng (mọi dòng)" hint="Giữ cố định để đồng nhất. VD: giọng nam miền Bắc, truyền cảm.">
            <Input value={p.settings.voiceInstruction} onChange={(e) => update({ voiceInstruction: e.target.value })} placeholder="Giọng nam miền Bắc, trầm ấm, truyền cảm…" />
          </Field>
          <Field label="Scene — bối cảnh (mọi dòng)" hint="VD: quảng cáo sôi động, kêu gọi mua ngay.">
            <Input value={p.settings.scene} onChange={(e) => update({ scene: e.target.value })} placeholder="Quảng cáo sôi động, kêu gọi mua ngay…" />
          </Field>
        </div>
      </div>

      {/* rows */}
      <div className="flex-1 overflow-y-auto px-7 py-5">
        {total === 0 ? (
          <EmptyState icon={Plus} title="Chưa có dòng nào" hint="Thêm văn bản hoặc import CSV để bắt đầu." action={<Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Thêm dòng</Button>} />
        ) : (
          <div className="flex flex-col gap-2">
            {p.rows.map((r) => (
              <RowItem key={r.id} row={r} onRegen={() => regen(r)} onEdit={() => setEditing(r)} onRemove={() => removeRow(r)} />
            ))}
          </div>
        )}
      </div>

      <ImportModal open={importing} onClose={() => setImporting(false)} onImport={async (rows) => {
        await ipc.projects.addRows(p.id, rows)
        await loadProject(p.id)
        setImporting(false)
        toast.success(`Đã thêm ${rows.length} dòng`)
      }} />
      <RowEditModal row={editing} voices={[...VOICES]} onClose={() => setEditing(null)} onSave={async (patch) => {
        if (editing) {
          await ipc.projects.updateRow(p.id, editing.id, { ...patch, status: 'pending', filePath: undefined })
          await loadProject(p.id)
        }
        setEditing(null)
      }} />

      <Modal open={!!confirmEst} onClose={() => setConfirmEst(null)} title="Xác nhận tạo"
        footer={<><Button variant="ghost" onClick={() => setConfirmEst(null)}>Hủy</Button><Button variant="primary" onClick={start}>Tạo {confirmEst?.requests} dòng</Button></>}>
        {confirmEst && (
          <div className="flex flex-col gap-2 text-sm text-ink-muted">
            <div className="flex justify-between"><span>Số dòng cần tạo</span><span className="tnum text-ink">{confirmEst.requests}</span></div>
            <div className="flex justify-between"><span>Token (ước tính)</span><span className="tnum text-ink">{confirmEst.inputTokens.toLocaleString()} in · {confirmEst.outputTokens.toLocaleString()} audio</span></div>
            <div className="flex justify-between"><span>Chi phí ước tính (nếu dùng key Paid)</span><span className="tnum font-semibold text-ink">${confirmEst.costUsd.toFixed(4)}</span></div>
            <p className="mt-1 text-xs text-ink-faint">Dùng key Free thì miễn phí. Dòng đã có trong cache sẽ không tốn thêm.</p>
          </div>
        )}
      </Modal>

      {/* refresh quota when batch progresses */}
      <QuotaSync trigger={done} onSync={refreshQuota} />
    </div>
  )
}

function QuotaSync({ trigger, onSync }: { trigger: number; onSync: () => void }) {
  useEffect(() => { onSync() }, [trigger, onSync])
  return null
}

function RowItem({ row, onRegen, onEdit, onRemove }: { row: Row; onRegen: () => void; onEdit: () => void; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const play = async () => {
    if (src || !row.filePath) return
    setLoading(true)
    try {
      const { base64, mime } = await ipc.file.readAudio(row.filePath)
      setSrc(`data:${mime};base64,${base64}`)
    } catch { toast.error('Không đọc được file audio') } finally { setLoading(false) }
  }

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="tnum w-7 shrink-0 text-xs text-ink-faint">{String(row.idx + 1).padStart(2, '0')}</span>
        <Badge status={rowStatus[row.status]} />
        <p className="min-w-0 flex-1 truncate text-sm text-ink" title={row.text}>{row.text}</p>
        {row.cached && <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent-to" title="Dùng lại từ cache, không tốn phí">cache</span>}
        <span className="hidden shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-ink-muted sm:block">{row.voice}</span>
        <div className="flex shrink-0 items-center gap-1">
          {row.status === 'done' && row.filePath && (
            <button onClick={play} title="Nghe" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onRegen} title="Tạo lại" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onEdit} title="Sửa" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-ink"><Pencil className="h-4 w-4" /></button>
          <button onClick={onRemove} title="Xóa" className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-status-error"><Trash2 className="h-4 w-4" /></button>
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

function ImportModal({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (rows: { text: string; voice?: string; style?: string }[]) => void }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'lines' | 'csv'>('lines')
  useEffect(() => { if (open) { setText(''); setMode('lines') } }, [open])

  const importCsvFile = async () => {
    const path = await ipc.sys.pickFile([{ name: 'CSV/TSV', extensions: ['csv', 'tsv', 'txt'] }])
    if (!path) return
    const content = await ipc.file.readText(path).catch(() => '')
    if (content) setText(content)
    setMode('csv')
  }

  const rows = useMemo(() => {
    if (mode === 'lines') return parseLines(text).map((t) => ({ text: t }))
    const grid = parseDelimited(text)
    // assume columns: text [, voice [, style]]; skip header if first cell looks like "text"
    const body = grid.length && /text|văn bản|noi dung|nội dung/i.test(grid[0][0]) ? grid.slice(1) : grid
    return body.map((r) => ({ text: r[0] ?? '', voice: r[1] || undefined, style: r[2] || undefined })).filter((r) => r.text.trim())
  }, [text, mode])

  return (
    <Modal open={open} onClose={onClose} title="Thêm dòng" width={560}
      footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" disabled={rows.length === 0} onClick={() => onImport(rows)}>Thêm {rows.length} dòng</Button></>}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant={mode === 'lines' ? 'primary' : 'secondary'} onClick={() => setMode('lines')}>Mỗi dòng 1 sản phẩm</Button>
          <Button size="sm" variant={mode === 'csv' ? 'primary' : 'secondary'} onClick={() => setMode('csv')}>CSV (text, voice, style)</Button>
          <Button size="sm" variant="ghost" onClick={importCsvFile}>Chọn file…</Button>
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-48 font-mono text-[13px]" placeholder={mode === 'lines' ? 'Mỗi dòng một câu...' : 'Văn bản,Kore,Đọc vui vẻ\nCâu khác,Puck,'} />
        <p className="text-xs text-ink-faint">{rows.length} dòng hợp lệ sẽ được thêm.</p>
      </div>
    </Modal>
  )
}

function RowEditModal({ row, voices, onClose, onSave }: { row: Row | null; voices: string[]; onClose: () => void; onSave: (patch: { text: string; voice: string; style: string }) => void }) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('Kore')
  const [style, setStyle] = useState('')
  useEffect(() => { if (row) { setText(row.text); setVoice(row.voice); setStyle(row.style) } }, [row])
  return (
    <Modal open={!!row} onClose={onClose} title="Sửa dòng" width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" onClick={() => onSave({ text, voice, style })}>Lưu & đặt lại</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Văn bản"><Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-28" /></Field>
        <div className="flex gap-4">
          <div className="flex-1"><Field label="Giọng"><Select value={voice} onChange={(e) => setVoice(e.target.value)}>{voices.map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field></div>
          <div className="flex-1"><Field label="Phong cách (tùy chọn)"><Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Đọc vui vẻ" /></Field></div>
        </div>
      </div>
    </Modal>
  )
}
