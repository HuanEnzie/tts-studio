import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  icon?: ReactNode
  disabled?: boolean
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  title?: string
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-2xl'
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent-gradient text-white shadow-glow hover:brightness-110 font-medium',
  secondary:
    'bg-surface-raised text-ink border border-border hover:bg-surface-hover hover:border-border-strong',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-hover',
  danger:
    'bg-status-error/15 text-status-error border border-status-error/30 hover:bg-status-error/25'
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  className,
  onClick,
  type = 'button',
  title
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      whileHover={{ y: disabled ? 0 : -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'no-drag inline-flex items-center justify-center select-none whitespace-nowrap',
        'transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent-from/60',
        sizes[size],
        variants[variant],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </motion.button>
  )
}
