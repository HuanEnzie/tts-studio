import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Search, FolderOpen, Copy, Pencil, Trash2, FolderInput, FolderKanban
} from 'lucide-react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { Badge, type Status } from '../design/Badge'
import { PageHeader } from '../design/PageHeader'
import { EmptyState } from '../design/EmptyState'
import { Modal } from '../design/Modal'
import { Field, Input } from '../design/Input'
import { ProjectConfigFields } from '../components/ProjectConfigFields'
import { ipc } from '../lib/ipc'
import { useProjects } from '../store/projects'
import { useNav } from '../store/nav'
import { toast } from '../store/toast'
import type { Project, ProjectSettings, AppSettings, VoicePreset } from '@shared/types'

const statusMap: Record<Project['status'], Status> = {
  draft: 'pending',
  running: 'running',
  done: 'done',
  partial: 'warn',
  error: 'error'
}

function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function Projects() {
  const { list, refreshList } = useProjects()
  const openProject = useNav((s) => s.openProject)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const filtered = useMemo(
    () => list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [list, q]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-7">
      <PageHeader
        title="Dự án"
        subtitle="Mỗi dự án là một phiên tạo TTS hàng loạt, tự lưu tiến trình."
        action={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Dự án mới
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm dự án…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={list.length === 0 ? 'Chưa có dự án nào' : 'Không tìm thấy dự án'}
          hint={list.length === 0 ? 'Tạo dự án đầu tiên để bắt đầu tạo TTS hàng loạt.' : undefined}
          action={
            list.length === 0 ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                Dự án mới
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, i) => {
            const done = p.rows.filter((r) => r.status === 'done').length
            const total = p.rows.length
            const pct = total ? Math.round((done / total) * 100) : 0
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 30 }}
              >
                <Card hover className="group p-5" onClick={() => openProject(p.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <Badge status={statusMap[p.status]} />
                    <span className="tnum text-xs text-ink-faint">{fmtDate(p.updatedAt)}</span>
                  </div>

                  <h3 className="mt-3 line-clamp-1 font-medium text-ink">{p.name}</h3>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Tiến độ</span>
                      <span className="tnum text-ink-muted">{done}/{total}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-accent-gradient transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-4 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="ghost" icon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => openProject(p.id)}>
                      Mở
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      onClick={async () => {
                        await ipc.projects.duplicate(p.id)
                        refreshList()
                        toast.success('Đã nhân bản dự án')
                      }}
                    >
                      Nhân bản
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setRenaming(p)}>
                      Đổi tên
                    </Button>
                    <Button size="sm" variant="ghost" icon={<FolderInput className="h-3.5 w-3.5" />} onClick={() => ipc.sys.openProjectFolder(p.id)}>
                      Folder
                    </Button>
                    <Button size="sm" variant="ghost" className="text-status-error" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(p)}>
                      Xóa
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <CreateModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refreshList(); openProject(id) }} />
      <RenameModal project={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); refreshList() }} />
      <DeleteModal project={deleting} onClose={() => setDeleting(null)} onDone={() => { setDeleting(null); refreshList() }} />
    </div>
  )
}

function settingsFromDefaults(s: AppSettings): ProjectSettings {
  return {
    voice: s.defaultVoice,
    style: s.defaultStyle,
    voiceInstruction: s.voiceInstruction,
    scene: s.scene,
    languageCode: s.languageCode,
    temperature: s.temperature,
    seed: s.seed,
    format: s.format,
    filenameTemplate: s.filenameTemplate,
    budgetUsd: 0
  }
}

function CreateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [draft, setDraft] = useState<ProjectSettings | null>(null)
  const [presets, setPresets] = useState<VoicePreset[]>([])

  useEffect(() => {
    if (open) {
      setName(`Dự án ${new Date().toISOString().slice(0, 10)}`)
      ipc.settings.get().then((s) => setDraft(settingsFromDefaults(s)))
      ipc.presets.list().then(setPresets)
    }
  }, [open])

  const create = async () => {
    if (!draft) return
    const p = await ipc.projects.create(name.trim() || 'Dự án không tên')
    await ipc.projects.update(p.id, draft)
    toast.success('Đã tạo dự án')
    onCreated(p.id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dự án mới — cấu hình giọng"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={create}>Tạo dự án</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Tên dự án">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <p className="-mt-1 text-xs text-ink-faint">Chọn/giấu cấu hình giọng cho cả dự án (1 dự án = 1 giọng). Đổi được sau ở nút cấu hình trong dự án.</p>
        {draft && <ProjectConfigFields value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} presets={presets} />}
      </div>
    </Modal>
  )
}

function RenameModal({ project, onClose, onDone }: { project: Project | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  useEffect(() => { if (project) setName(project.name) }, [project])
  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title="Đổi tên dự án"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={async () => { if (project) { await ipc.projects.rename(project.id, name.trim() || project.name); toast.success('Đã đổi tên'); onDone() } }}>Lưu</Button>
        </>
      }
    >
      <Field label="Tên mới">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Modal>
  )
}

function DeleteModal({ project, onClose, onDone }: { project: Project | null; onClose: () => void; onDone: () => void }) {
  const [delFiles, setDelFiles] = useState(false)
  useEffect(() => { setDelFiles(false) }, [project])
  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title="Xóa dự án"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={async () => { if (project) { await ipc.projects.remove(project.id, delFiles); toast.success('Đã xóa dự án'); onDone() } }}>Xóa</Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        Xóa dự án <span className="font-medium text-ink">"{project?.name}"</span>? Hành động không thể hoàn tác.
      </p>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-ink-muted">
        <input type="checkbox" checked={delFiles} onChange={(e) => setDelFiles(e.target.checked)} className="h-4 w-4 accent-[#7C5CFF]" />
        Xóa luôn các file audio đã xuất trong folder dự án
      </label>
    </Modal>
  )
}
