import type { ReactNode } from 'react'

/**
 * Stat Readout — 距離・時間・金額の mono 表示（7章）。
 * 数字を揃えるため tabular-nums を効かせている。
 */
export function StatReadout({
  label,
  value,
  tone = 'light',
  size = 'm',
}: {
  label: string
  value: ReactNode
  tone?: 'light' | 'dark'
  size?: 's' | 'm' | 'l'
}) {
  const valueSize = size === 'l' ? 'text-[26px]' : size === 's' ? 'text-[14px]' : 'text-stat-l'
  return (
    <div className="min-w-0">
      <div
        className={`label-caps ${tone === 'dark' ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}
      >
        {label}
      </div>
      <div
        className={`mono-readout ${valueSize} mt-1 truncate ${
          tone === 'dark' ? 'text-text-porcelain' : 'text-text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

/** カード下部などに並べる横一列の readout。 */
export function StatRow({
  items,
  tone = 'light',
  className = '',
}: {
  items: { label: string; value: ReactNode }[]
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <div className={`grid gap-4 ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <StatReadout key={it.label} label={it.label} value={it.value} tone={tone} size="s" />
      ))}
    </div>
  )
}
