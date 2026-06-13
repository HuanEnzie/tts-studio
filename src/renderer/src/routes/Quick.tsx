import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Download, Loader2, Sparkles } from 'lucide-react'
import { Button } from '../design/Button'
import { Card } from '../design/Card'
import { PageHeader } from '../design/PageHeader'
import { AudioPlayer } from '../components/AudioPlayer'
import { ipc } from '../lib/ipc'
import { useQuota } from '../store/quota'
import { toast } from '../store/toast'
import { slugify } from '@shared/filename'
import { VOICES } from '@shared/types'

const STYLE_PRESETS = ['Đọc vui vẻ', 'Đọc nghiêm túc', 'Đọc chậm rãi', 'Đọc hào hứng', 'Giọng tâm sự']

export function Quick() {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('Kore')
  const [style, setStyle] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ id: string; src: string } | null>(null)
  const refreshQuota = useQuota((s) => s.refresh)

  const chars = text.length
  const reqs = Math.max(1, Math.ceil(chars / 1500))

  const synth = async () => {
    if (!text.trim()) { toast.info('Nhập văn bản trước đã'); return }
    setBusy(true)
    setResult(null)
    try {
      const { id, wavBase64 } = await ipc.quick.synth(text, voice, style)
      setResult({ id, src: `data:audio/wav;base64,${wavBase64}` })
      refreshQuota()
    } catch (e) {
      toast.error((e as Error).message || 'Tạo thất bại')
    } finally {
      setBusy(false)
    }
  }

  const save = async (format: 'mp3' | 'wav') => {
    if (!result) return
    try {
      const path = await ipc.quick.save(result.id, slugify(text) || 'tts', format)
      if (path) toast.success(`Đã lưu: ${path}`)
    } catch (e) {
      toast.error((e as Error).message || 'Lưu thất bại')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-7">
      <PageHeader title="Tạo nhanh" subtitle="Nhập một đoạn, chọn giọng, nghe và lưu ngay." />

      <Card className="p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập văn bản cần đọc… (mẹo: thêm phong cách bên dưới, hoặc thẻ [whispers] trong câu)"
          className="h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-faint outline-none"
        />
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="tnum text-xs text-ink-faint">{chars} ký tự · ~{reqs} request</span>
        </div>
      </Card>

      {/* style presets */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"><Sparkles className="h-3.5 w-3.5" /> Phong cách</span>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((s) => (
            <button key={s} onClick={() => setStyle(style === s ? '' : s)}
              className={'no-drag rounded-lg border px-3 py-1.5 text-xs transition ' + (style === s ? 'border-accent-from/40 bg-accent-soft text-ink' : 'border-border bg-surface text-ink-muted hover:text-ink')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* voices */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink-muted">Giọng đọc</span>
        <div className="flex flex-wrap gap-2">
          {VOICES.slice(0, 12).map((v) => (
            <button key={v} onClick={() => setVoice(v)}
              className={'no-drag rounded-xl border px-3 py-2 text-sm transition ' + (v === voice ? 'border-accent-from/40 bg-accent-soft text-ink' : 'border-border bg-surface text-ink-muted hover:text-ink hover:border-border-strong')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="primary" size="lg" disabled={busy} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} onClick={synth}>
          {busy ? 'Đang tạo…' : 'Tạo giọng đọc'}
        </Button>
        <Button variant="secondary" size="lg" icon={<Download className="h-4 w-4" />} disabled={!result} onClick={() => save('mp3')}>Lưu MP3</Button>
        <Button variant="ghost" size="lg" disabled={!result} onClick={() => save('wav')}>Lưu WAV</Button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5"><AudioPlayer src={result.src} autoPlay /></Card>
        </motion.div>
      )}
    </div>
  )
}
