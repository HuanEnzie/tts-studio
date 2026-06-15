import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Trash2, BookA } from 'lucide-react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { PageHeader } from '../design/PageHeader'
import { Field, Input, Select, Textarea } from '../design/Input'
import { ipc } from '../lib/ipc'
import { toast } from '../store/toast'
import { buildFilename } from '@shared/filename'
import { VOICES, TTS_MODELS, type AppSettings, type DictEntry } from '@shared/types'

export function Settings() {
  const [s, setS] = useState<AppSettings | null>(null)
  const [dict, setDict] = useState<DictEntry[]>([])

  useEffect(() => {
    ipc.settings.get().then(setS)
    ipc.dict.list().then(setDict)
  }, [])

  if (!s) return null

  const patch = async (p: Partial<AppSettings>) => {
    const next = await ipc.settings.set(p)
    setS(next)
  }

  const preview = buildFilename(s.filenameTemplate, {
    date: '2026-06-13', datetime: '2026-06-13_142300', project: 'QuangCao', index: 1, voice: s.defaultVoice, text: 'ưu đãi tháng 6'
  }) + '.' + s.format

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-7">
      <PageHeader title="Cài đặt" subtitle="Thư mục xuất, mẫu tên file, model, quota và từ điển phát âm." />

      <Card className="flex flex-col gap-5 p-5">
        <h3 className="text-sm font-semibold text-ink">Xuất file</h3>
        <Field label="Thư mục xuất gốc">
          <div className="flex gap-2">
            <Input value={s.outputRoot} onChange={(e) => patch({ outputRoot: e.target.value })} className="flex-1" />
            <Button variant="secondary" icon={<FolderOpen className="h-4 w-4" />} onClick={async () => { const d = await ipc.sys.pickFolder(); if (d) patch({ outputRoot: d }) }}>Chọn</Button>
          </div>
        </Field>
        <div className="flex gap-4">
          <div className="w-32"><Field label="Định dạng"><Select value={s.format} onChange={(e) => patch({ format: e.target.value as 'mp3' | 'wav' })}><option value="mp3">MP3</option><option value="wav">WAV</option></Select></Field></div>
          <div className="flex-1"><Field label="Mẫu tên file mặc định" hint={<>Ví dụ: <span className="text-ink-muted">{preview}</span> · biến: {'{date} {datetime} {project} {index} {slug} {voice}'}</>}>
            <Input value={s.filenameTemplate} onChange={(e) => patch({ filenameTemplate: e.target.value })} /></Field></div>
        </div>
      </Card>

      <Card className="flex flex-col gap-5 p-5">
        <h3 className="text-sm font-semibold text-ink">TTS & Quota</h3>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[260px] flex-1"><Field label="Model TTS"><Select value={s.model} onChange={(e) => patch({ model: e.target.value })}>{(TTS_MODELS.includes(s.model as never) ? TTS_MODELS : [s.model, ...TTS_MODELS]).map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field></div>
          <div className="w-40"><Field label="Giọng mặc định"><Select value={s.defaultVoice} onChange={(e) => patch({ defaultVoice: e.target.value })}>{VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field></div>
          <div className="w-44"><Field label="Giới hạn req/key/ngày" hint="Free tier ~10"><Input type="number" value={s.dailyLimitPerKey} onChange={(e) => patch({ dailyLimitPerKey: Math.max(1, Number(e.target.value) || 1) })} /></Field></div>
        </div>
        <Field label="Yêu cầu giọng mặc định" hint="Áp cho Tạo nhanh và dùng làm mặc định cho dự án mới. VD: giọng nam miền Bắc, truyền cảm, phù hợp video TVC.">
          <Textarea value={s.voiceInstruction} onChange={(e) => patch({ voiceInstruction: e.target.value })} className="h-20" placeholder="VD: Giọng nam miền Bắc, trầm ấm, truyền cảm, tốc độ vừa phải, phù hợp quảng cáo TVC." />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <h3 className="text-sm font-semibold text-ink">Mạng / Proxy</h3>
        <p className="-mt-2 text-xs text-ink-faint">Nếu gặp lỗi "User location is not supported", Gemini đang chặn vùng IP của bạn. Đặt proxy HTTP/HTTPS ở vùng được hỗ trợ (vd US) để đi vòng. Để trống nếu không cần.</p>
        <Field label="Proxy URL">
          <Input value={s.proxyUrl} onChange={(e) => patch({ proxyUrl: e.target.value })} placeholder="http://user:pass@host:port" />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><BookA className="h-4 w-4 text-ink-muted" /> Từ điển phát âm</h3>
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={async () => { const e = await ipc.dict.add('', ''); setDict([...dict, e]) }}>Thêm</Button>
        </div>
        <p className="-mt-2 text-xs text-ink-faint">Thay thế trước khi đọc, vd "TP.HCM" → "Thành phố Hồ Chí Minh". Khớp nguyên từ, không phân biệt hoa thường.</p>
        {dict.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-faint">Chưa có mục nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dict.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input type="checkbox" checked={d.enabled} className="h-4 w-4 accent-[#7C5CFF]" onChange={async (e) => { await ipc.dict.update(d.id, { enabled: e.target.checked }); setDict(dict.map((x) => x.id === d.id ? { ...x, enabled: e.target.checked } : x)) }} />
                <Input defaultValue={d.pattern} placeholder="Từ gốc" className="flex-1" onBlur={async (e) => { await ipc.dict.update(d.id, { pattern: e.target.value }) }} />
                <span className="text-ink-faint">→</span>
                <Input defaultValue={d.replacement} placeholder="Đọc thành" className="flex-1" onBlur={async (e) => { await ipc.dict.update(d.id, { replacement: e.target.value }) }} />
                <button onClick={async () => { await ipc.dict.remove(d.id); setDict(dict.filter((x) => x.id !== d.id)) }} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-status-error"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
