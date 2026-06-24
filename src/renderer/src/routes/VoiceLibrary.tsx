import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Library as LibraryIcon, Dices, Pencil, Mic } from 'lucide-react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { PageHeader } from '../design/PageHeader'
import { EmptyState } from '../design/EmptyState'
import { Modal } from '../design/Modal'
import { Field, Input, Textarea, Select } from '../design/Input'
import { ipc } from '../lib/ipc'
import { toast } from '../store/toast'
import { VOICES, LANGS, STYLE_PRESETS, type VoicePreset, type AppSettings } from '@shared/types'

export function VoiceLibrary() {
  const [presets, setPresets] = useState<VoicePreset[]>([])
  const [defaults, setDefaults] = useState<AppSettings | null>(null)
  const [editing, setEditing] = useState<VoicePreset | null>(null)

  useEffect(() => {
    ipc.presets.list().then(setPresets)
    ipc.settings.get().then(setDefaults)
  }, [])

  const add = async () => {
    const e = await ipc.presets.add({
      name: 'Giọng mới',
      voice: defaults?.defaultVoice ?? 'Kore',
      context: defaults?.voiceInstruction ?? '',
      scene: defaults?.scene ?? '',
      style: '',
      languageCode: defaults?.languageCode ?? 'vi-VN',
      temperature: defaults?.temperature ?? 1,
      seed: defaults?.seed ?? 42
    })
    setPresets((prev) => [...prev, e])
    setEditing(e)
  }

  const remove = async (id: string) => {
    await ipc.presets.remove(id)
    setPresets((prev) => prev.filter((x) => x.id !== id))
    toast.success('Đã xóa giọng')
  }

  const save = async (p: VoicePreset) => {
    const { id, ...patch } = p
    await ipc.presets.update(id, patch)
    setPresets((prev) => prev.map((x) => (x.id === id ? p : x)))
    setEditing(null)
    toast.success('Đã lưu giọng')
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-7">
      <PageHeader
        title="Thư viện giọng"
        subtitle="Mỗi giọng giữ cố định voice + context + scene + style + temperature + seed để tái dùng và đồng nhất tông."
        action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add}>Thêm giọng</Button>}
      />

      {presets.length === 0 ? (
        <EmptyState icon={LibraryIcon} title="Thư viện trống" hint="Thêm một giọng để tái dùng cho các dự án."
          action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add}>Thêm giọng</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((pr, i) => (
            <motion.div key={pr.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card hover className="group flex items-center gap-3 p-3" onClick={() => setEditing(pr)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                  <Mic className="h-4 w-4 text-accent-to" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{pr.name}</p>
                  <p className="tnum truncate text-xs text-ink-faint">{pr.voice} · seed {pr.seed} · t{pr.temperature} · {pr.languageCode}</p>
                </div>
                <Pencil className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition group-hover:opacity-100" />
                <button onClick={(e) => { e.stopPropagation(); remove(pr.id) }} className="rounded-lg p-1.5 text-ink-faint opacity-0 transition hover:text-status-error group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <EditModal preset={editing} onClose={() => setEditing(null)} onSave={save} />
    </div>
  )
}

function EditModal({ preset, onClose, onSave }: { preset: VoicePreset | null; onClose: () => void; onSave: (p: VoicePreset) => void }) {
  const [p, setP] = useState<VoicePreset | null>(preset)
  useEffect(() => setP(preset), [preset])
  if (!p) return null
  const set = (patch: Partial<VoicePreset>) => setP({ ...p, ...patch })

  return (
    <Modal open={!!preset} onClose={onClose} title="Chỉnh giọng" width={560}
      footer={<><Button variant="ghost" onClick={onClose}>Hủy</Button><Button variant="primary" onClick={() => onSave(p)}>Lưu</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Tên giọng"><Input value={p.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></Field>
        <div className="flex gap-3">
          <div className="flex-1"><Field label="Giọng"><Select value={p.voice} onChange={(e) => set({ voice: e.target.value })}>{VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field></div>
          <div className="flex-1"><Field label="Ngôn ngữ"><Select value={p.languageCode} onChange={(e) => set({ languageCode: e.target.value })}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></Field></div>
        </div>
        <Field label="Phong cách (style)">
          <Input value={p.style} onChange={(e) => set({ style: e.target.value })} placeholder="VD: đọc vui vẻ, trò chuyện tự nhiên" list="style-presets" />
          <datalist id="style-presets">{STYLE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Context — mô tả giọng"><Textarea value={p.context} onChange={(e) => set({ context: e.target.value })} className="h-16" placeholder="nam 20 tuổi, miền Bắc, tự tin, giọng trò chuyện tự nhiên…" /></Field>
        <Field label="Scene — bối cảnh"><Input value={p.scene} onChange={(e) => set({ scene: e.target.value })} placeholder="trong quán cà phê…" /></Field>
        <div className="flex gap-3">
          <div className="w-32"><Field label="Temperature" hint="Thấp = ổn định"><Input type="number" step="0.1" min="0" max="2" value={p.temperature} onChange={(e) => set({ temperature: Math.max(0, Math.min(2, Number(e.target.value))) })} /></Field></div>
          <div className="flex-1"><Field label="Seed (giữ tông)">
            <div className="flex gap-1">
              <Input type="number" value={p.seed} onChange={(e) => set({ seed: Math.floor(Number(e.target.value) || 0) })} className="flex-1" />
              <button title="Đổi seed" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })} className="shrink-0 rounded-xl border border-border bg-surface px-2 text-ink-muted transition hover:text-ink"><Dices className="h-4 w-4" /></button>
            </div>
          </Field></div>
        </div>
      </div>
    </Modal>
  )
}
