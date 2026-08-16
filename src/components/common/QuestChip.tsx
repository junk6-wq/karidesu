import type { ReactNode } from 'react'
import type { QuestSeverity } from '@/types'

const TONE: Record<QuestSeverity, string> = {
  info: 'border-black/10 bg-black/[0.04] text-text-ink/70',
  warn: 'border-[color:var(--c-amber)]/40 bg-[color:var(--c-amber)]/12 text-[color:var(--c-amber)]',
  risk: 'border-brick/40 bg-brick/10 text-brick',
}

const MARK: Record<QuestSeverity, string> = { info: '·', warn: '!', risk: '!' }

/**
 * Quest Chip — AI からの提案・警告を示す小さなバッジ（7章）。
 * ゲームのクエスト表示に近い、短く読み切れる文言だけを載せる。
 */
export function QuestChip({
  severity = 'info',
  children,
}: {
  severity?: QuestSeverity
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-tight ${TONE[severity]}`}
    >
      <span className="mono-readout font-bold">{MARK[severity]}</span>
      <span>{children}</span>
    </span>
  )
}

/** 中立的なラベル用の小さなチップ。 */
export function Chip({
  children,
  active = false,
  onClick,
  tone = 'light',
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  tone?: 'light' | 'dark'
}) {
  const Comp = onClick ? 'button' : 'span'
  const activeCls =
    tone === 'dark'
      ? 'border-brass bg-brass/20 text-brass'
      : 'border-brass bg-brass/15 text-[#7a5f2b]'
  const idleCls =
    tone === 'dark'
      ? 'border-white/20 text-text-porcelain/70 hover:border-white/40'
      : 'border-black/12 text-text-ink/65 hover:border-black/25'
  return (
    <Comp
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] transition duration-200 ease-passage ${
        active ? activeCls : idleCls
      }`}
    >
      {children}
    </Comp>
  )
}
