import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from 'react'
import { cn } from './cn'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink',
        'placeholder:text-ink-faint outline-none transition',
        'focus:border-accent-from/50 focus:ring-2 focus:ring-accent-from/20',
        className
      )}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink',
        'placeholder:text-ink-faint outline-none transition',
        'focus:border-accent-from/50 focus:ring-2 focus:ring-accent-from/20',
        className
      )}
    />
  )
}

export function Select({ className, children, ...props }: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...(props as object)}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink outline-none transition',
        'focus:border-accent-from/50 focus:ring-2 focus:ring-accent-from/20',
        className
      )}
    >
      {children}
    </select>
  )
}
