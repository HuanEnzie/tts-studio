import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '../design/cn'

function fmt(t: number): string {
  if (!isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AudioPlayer({
  src,
  autoPlay,
  compact
}: {
  src: string
  autoPlay?: boolean
  compact?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  useEffect(() => {
    const a = new Audio(src)
    audioRef.current = a
    const onTime = () => setCur(a.currentTime)
    const onMeta = () => setDur(a.duration)
    const onEnd = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    if (autoPlay) {
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
    return () => {
      a.pause()
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
    }
  }, [src, autoPlay])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    a.currentTime = pct * dur
  }

  const pct = dur ? (cur / dur) * 100 : 0

  return (
    <div className={cn('flex items-center gap-3', compact ? '' : 'w-full')}>
      <button
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white shadow-glow transition hover:brightness-110"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex flex-1 items-center gap-2">
        <div
          onClick={seek}
          className="group relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-surface-hover"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent-gradient"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tnum w-20 text-right text-xs text-ink-muted">
          {fmt(cur)} / {fmt(dur)}
        </span>
      </div>
    </div>
  )
}
