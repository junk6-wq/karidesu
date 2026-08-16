import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Tone = 'light' | 'dark'

const base =
  'tap inline-flex items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold ' +
  'transition duration-200 ease-passage disabled:opacity-40 disabled:pointer-events-none select-none'

function classesFor(variant: Variant, tone: Tone): string {
  switch (variant) {
    case 'primary':
      // 7章: 旅を進める行動は Brass Gold 塗り + Ink Navy 文字
      return `${base} bg-brass text-ink hover:brightness-110 active:brightness-95 shadow-card`
    case 'secondary':
      return tone === 'dark'
        ? `${base} border border-white/25 text-text-porcelain hover:bg-white/10`
        : `${base} border border-black/15 text-text-ink hover:bg-black/[0.04]`
    case 'destructive':
      return `${base} border border-brick/40 text-brick hover:bg-brick/10`
    case 'ghost':
    default:
      return tone === 'dark'
        ? `${base} text-text-porcelain/80 hover:text-text-porcelain hover:bg-white/10`
        : `${base} text-text-ink/70 hover:text-text-ink hover:bg-black/[0.04]`
  }
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  tone?: Tone
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  tone = 'light',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={`${classesFor(variant, tone)} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'secondary',
  tone = 'light',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${classesFor(variant, tone)} ${className}`}>
      {children}
    </Link>
  )
}
