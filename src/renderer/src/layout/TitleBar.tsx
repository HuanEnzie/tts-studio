import { AudioLines } from 'lucide-react'

// Frameless draggable top bar. Real window controls come from the OS
// (hiddenInset on mac / native on win). This just holds the wordmark + drag region.
export function TitleBar() {
  return (
    <div className="drag flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gradient shadow-glow">
          <AudioLines className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold tracking-tight">
          TTS <span className="text-gradient">Studio</span>
        </span>
      </div>
    </div>
  )
}
