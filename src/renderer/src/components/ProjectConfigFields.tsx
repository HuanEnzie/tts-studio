import { useState } from 'react'
import { Dices } from 'lucide-react'
import { Field, Input, Select } from '../design/Input'
import { VOICES, LANGS, STYLE_PRESETS, type ProjectSettings, type VoicePreset } from '@shared/types'

// Shared voice/output config used both when creating a project and when editing
// it later (in a popup) — so the project screen itself stays clean.
export function ProjectConfigFields({
  value,
  onChange,
  presets
}: {
  value: ProjectSettings
  onChange: (patch: Partial<ProjectSettings>) => void
  presets: VoicePreset[]
}) {
  const [presetId, setPresetId] = useState('')
  const applyPreset = (id: string) => {
    setPresetId(id)
    const pr = presets.find((x) => x.id === id)
    if (!pr) return
    onChange({
      voice: pr.voice,
      voiceInstruction: pr.context,
      scene: pr.scene,
      style: pr.style,
      languageCode: pr.languageCode,
      temperature: pr.temperature,
      seed: pr.seed
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {presets.length > 0 && (
        <Field label="Áp giọng từ thư viện">
          <Select value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">— chọn giọng đã lưu —</option>
            {presets.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Giọng đọc">
          <Select value={value.voice} onChange={(e) => onChange({ voice: e.target.value })}>
            {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Ngôn ngữ">
          <Select value={value.languageCode} onChange={(e) => onChange({ languageCode: e.target.value })}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Phong cách (style)">
        <Input value={value.style} onChange={(e) => onChange({ style: e.target.value })} placeholder="đọc vui vẻ, trò chuyện tự nhiên…" list="cfg-styles" />
        <datalist id="cfg-styles">{STYLE_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Context — mô tả giọng" hint="VD: nam 20 tuổi, miền Bắc, trò chuyện tự nhiên.">
        <Input value={value.voiceInstruction} onChange={(e) => onChange({ voiceInstruction: e.target.value })} placeholder="Giọng nam miền Bắc, trầm ấm, truyền cảm…" />
      </Field>
      <Field label="Scene — bối cảnh" hint="VD: trong quán cà phê; quảng cáo sôi động.">
        <Input value={value.scene} onChange={(e) => onChange({ scene: e.target.value })} placeholder="Trong quán cà phê…" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature" hint="Thấp = ổn định">
          <Input type="number" step="0.1" min="0" max="2" value={value.temperature} onChange={(e) => onChange({ temperature: Math.max(0, Math.min(2, Number(e.target.value))) })} />
        </Field>
        <Field label="Seed (giữ tông)">
          <div className="flex gap-1">
            <Input type="number" value={value.seed} onChange={(e) => onChange({ seed: Math.floor(Number(e.target.value) || 0) })} className="flex-1" />
            <button title="Đổi seed" onClick={() => onChange({ seed: Math.floor(Math.random() * 1e9) })} className="shrink-0 rounded-xl border border-border bg-surface px-2 text-ink-muted transition hover:text-ink"><Dices className="h-4 w-4" /></button>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Định dạng">
          <Select value={value.format} onChange={(e) => onChange({ format: e.target.value as 'mp3' | 'wav' })}>
            <option value="mp3">MP3</option><option value="wav">WAV</option>
          </Select>
        </Field>
        <Field label="Trần $ dự án" hint="0 = không">
          <Input type="number" step="0.1" value={value.budgetUsd} onChange={(e) => onChange({ budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
      </div>
      <Field label="Mẫu tên file">
        <Input value={value.filenameTemplate} onChange={(e) => onChange({ filenameTemplate: e.target.value })} />
      </Field>
    </div>
  )
}
