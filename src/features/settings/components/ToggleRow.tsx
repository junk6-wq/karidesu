import type { ReactNode } from 'react'

/**
 * ラベル・説明・on/off スイッチの 1 行。
 * ネイティブ checkbox を label で包み、行のどこをタップしても切り替わるようにする。
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  badge,
  disabled = false,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  badge?: ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={`tap flex items-start justify-between gap-4 rounded-2xl border border-black/8 bg-white/70 p-4 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-text-ink">{label}</span>
          {badge}
        </span>
        {hint && (
          <span className="mt-1 block text-[12px] leading-relaxed text-text-ink/50">{hint}</span>
        )}
      </span>

      <span
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ease-passage"
        style={{ background: checked ? 'var(--c-brass-gold)' : 'rgba(20,24,28,0.16)' }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className="pointer-events-none inline-block h-5 w-5 translate-x-1 transform rounded-full bg-white shadow transition-transform duration-200 ease-passage"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </span>
    </label>
  )
}

/** セクション内で使う小さなステータスバッジ（「準備中」など）。 */
export function StatusBadge({ tone = 'muted', children }: { tone?: 'muted' | 'brass'; children: ReactNode }) {
  return (
    <span
      className={`label-caps rounded-full px-2 py-0.5 text-[10px] ${
        tone === 'brass' ? 'bg-brass/15 text-[#7a5f2b]' : 'bg-black/[0.06] text-text-ink/40'
      }`}
    >
      {children}
    </span>
  )
}
