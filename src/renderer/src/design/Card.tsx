import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from './cn'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, glass, onClick }: CardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'rounded-2xl border border-border shadow-soft',
        glass ? 'glass' : 'bg-surface',
        hover && 'cursor-pointer hover:border-border-strong hover:shadow-float',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
