import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useToast, type ToastKind } from '../store/toast'

const icon: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
}
const tint: Record<ToastKind, string> = {
  success: 'text-status-done',
  error: 'text-status-error',
  info: 'text-accent-to'
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icon[t.kind]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="glass pointer-events-auto flex min-w-[260px] max-w-sm items-start gap-3 rounded-xl border border-border px-4 py-3 shadow-float"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tint[t.kind]}`} />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-ink-faint transition hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
