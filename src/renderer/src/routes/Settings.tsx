import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Trash2, BookA, Plug, Loader2, CheckCircle2, XCircle, Bookmark } from 'lucide-react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { PageHeader } from '../design/PageHeader'
import { Field, Input, Select, Textarea } from '../design/Input'
import { ipc } from '../lib/ipc'
import { toast } from '../store/toast'
import { buildFilename } from '@shared/filename'
import { VOICES, TTS_MODELS, type AppSettings, type DictEntry, type VoicePreset } from '@shared/types'

export function Settings() {
  const [s, setS] = useState<AppSettings | null>(null)
  const [dict, setDict] = useState<DictEntry[]>([])
  const [presets, setPresets] = useState<VoicePreset[]>([])
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string } | null>(null)

  const runTest = async () => {
    setTesting(true)
    setTestRes(null)
    try {
      const r = await ipc.diag.test()
      setTestRes({ ok: r.ok, message: r.ok ? r.message : `Fail ở khâu "${r.stage}": ${r.message}` })
    } catch (e) {
      setTestRes({ ok: false, message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    ipc.settings.get().then(setS)
    ipc.dict.list().then(setDict)
    ipc.presets.list().then(setPresets)
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
        <h3 className="text-sm font-semibold text-ink">TTS & Hiệu năng</h3>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-[240px] flex-1"><Field label="Model TTS"><Select value={s.model} onChange={(e) => patch({ model: e.target.value })}>{(TTS_MODELS.includes(s.model as never) ? TTS_MODELS : [s.model, ...TTS_MODELS]).map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field></div>
          <div className="w-36"><Field label="Giọng mặc định"><Select value={s.defaultVoice} onChange={(e) => patch({ defaultVoice: e.target.value })}>{VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field></div>
          <div className="w-36"><Field label="Chạy song song" hint="Số task cùng lúc"><Input type="number" value={s.concurrency} onChange={(e) => patch({ concurrency: Math.max(1, Math.min(16, Number(e.target.value) || 1)) })} /></Field></div>
          <div className="w-36"><Field label="Timeout (giây)" hint="Hủy request treo"><Input type="number" value={s.requestTimeoutSec} onChange={(e) => patch({ requestTimeoutSec: Math.max(10, Number(e.target.value) || 120) })} /></Field></div>
          <div className="w-32"><Field label="Temperature mặc định" hint="Thấp = ổn định"><Input type="number" step="0.1" min="0" max="2" value={s.temperature} onChange={(e) => patch({ temperature: Math.max(0, Math.min(2, Number(e.target.value))) })} /></Field></div>
          <div className="w-32"><Field label="Seed mặc định" hint="Giữ tông"><Input type="number" value={s.seed} onChange={(e) => patch({ seed: Math.floor(Number(e.target.value) || 0) })} /></Field></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Context mặc định (mô tả giọng)" hint="VD: giọng nam miền Bắc, truyền cảm, phù hợp TVC.">
            <Textarea value={s.voiceInstruction} onChange={(e) => patch({ voiceInstruction: e.target.value })} className="h-16" />
          </Field>
          <Field label="Scene mặc định (bối cảnh)" hint="VD: quảng cáo sôi động, kêu gọi mua ngay.">
            <Textarea value={s.scene} onChange={(e) => patch({ scene: e.target.value })} className="h-16" />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-5 p-5">
        <h3 className="text-sm font-semibold text-ink">Chi phí & Ngân sách</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44"><Field label="Giá input $/1M token"><Input type="number" step="0.01" value={s.priceInputPerM} onChange={(e) => patch({ priceInputPerM: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
          <div className="w-44"><Field label="Giá audio $/1M token"><Input type="number" step="0.1" value={s.priceAudioPerM} onChange={(e) => patch({ priceAudioPerM: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
          <div className="w-48"><Field label="Trần chi tiêu/ngày ($)" hint="0 = không giới hạn"><Input type="number" step="0.5" value={s.dailyBudgetUsd} onChange={(e) => patch({ dailyBudgetUsd: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-ink-muted">
            <input type="checkbox" checked={s.cacheEnabled} className="h-4 w-4 accent-[#7C5CFF]" onChange={(e) => patch({ cacheEnabled: e.target.checked })} />
            Bỏ qua dòng trùng (cache)
          </label>
        </div>
        <p className="-mt-2 text-xs text-ink-faint">Key Free không tính phí. Key Paid tính theo token thật. Cache giúp khỏi trả tiền tạo lại nội dung y hệt.</p>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Bookmark className="h-4 w-4 text-ink-muted" /> Mẫu giọng (Preset)</h3>
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={async () => { const e = await ipc.presets.add({ name: 'Giọng mới', voice: s.defaultVoice, context: s.voiceInstruction, scene: s.scene, style: '', temperature: s.temperature, seed: s.seed }); setPresets([...presets, e]) }}>Thêm giọng</Button>
        </div>
        <p className="-mt-2 text-xs text-ink-faint">Mỗi giọng lưu kèm voice + context + scene + <b>temperature</b> + <b>seed</b> để áp 1 click cho dự án/Tạo nhanh và giữ tông đồng nhất.</p>
        {presets.length === 0 ? (
          <p className="py-3 text-center text-sm text-ink-faint">Chưa có giọng nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {presets.map((pr) => (
              <div key={pr.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <Input defaultValue={pr.name} className="w-32" onBlur={(e) => ipc.presets.update(pr.id, { name: e.target.value })} />
                <Select defaultValue={pr.voice} className="w-28" onChange={(e) => ipc.presets.update(pr.id, { voice: e.target.value })}>{VOICES.map((v) => <option key={v} value={v}>{v}</option>)}</Select>
                <Input defaultValue={pr.context} placeholder="Context" className="flex-1" onBlur={(e) => ipc.presets.update(pr.id, { context: e.target.value })} />
                <Input defaultValue={pr.scene} placeholder="Scene" className="flex-1" onBlur={(e) => ipc.presets.update(pr.id, { scene: e.target.value })} />
                <Input type="number" step="0.1" defaultValue={pr.temperature} title="temperature" className="w-16" onBlur={(e) => ipc.presets.update(pr.id, { temperature: Number(e.target.value) })} />
                <Input type="number" defaultValue={pr.seed} title="seed" className="w-20" onBlur={(e) => ipc.presets.update(pr.id, { seed: Math.floor(Number(e.target.value) || 0) })} />
                <button onClick={async () => { await ipc.presets.remove(pr.id); setPresets(presets.filter((x) => x.id !== pr.id)) }} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-hover hover:text-status-error"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <h3 className="text-sm font-semibold text-ink">Mạng / Proxy</h3>
        <p className="-mt-2 text-xs text-ink-faint">Nếu gặp lỗi "User location is not supported", Gemini đang chặn vùng IP của bạn. Đặt proxy HTTP/HTTPS ở vùng được hỗ trợ (vd US) để đi vòng. Để trống nếu không cần.</p>
        <Field label="Proxy URL">
          <Input value={s.proxyUrl} onChange={(e) => patch({ proxyUrl: e.target.value })} placeholder="http://user:pass@host:port" />
        </Field>

        <div>
          <Button variant="secondary" disabled={testing} icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} onClick={runTest}>
            {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </Button>
          {testRes && (
            <div className={'mt-2 flex items-start gap-1.5 rounded-lg border px-3 py-2 text-sm ' + (testRes.ok ? 'border-status-done/30 bg-status-done/10 text-status-done' : 'border-status-error/30 bg-status-error/10 text-status-error')}>
              {testRes.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="break-words">{testRes.message}</span>
            </div>
          )}
        </div>
        <p className="-mt-1 text-xs text-ink-faint">Chạy thử toàn bộ chuỗi: Key → Gemini → xuất MP3 (ffmpeg), và chỉ ra fail ở khâu nào. Tốn 1 request.</p>
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
