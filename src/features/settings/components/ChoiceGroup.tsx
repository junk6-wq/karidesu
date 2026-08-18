import { Chip } from '@/components/common/QuestChip'

/**
 * 単一選択のチップ群。数値をいきなり入力させず、選択式にするための土台。
 * 「1日の運転時間」のようなプリセット選択に使う。
 */
export function ChoiceGroup<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  multiline = false,
}: {
  label: string
  hint?: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  multiline?: boolean
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
      <span className="text-[14px] font-semibold text-text-ink">{label}</span>
      {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-text-ink/45">{hint}</p>}
      <div className={`mt-2.5 flex gap-2 ${multiline ? 'flex-wrap' : 'flex-wrap sm:flex-nowrap'}`}>
        {options.map((opt) => (
          <Chip key={opt.value} active={value === opt.value} onClick={() => onChange(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/**
 * 複数選択のチップ群。「旅行の好み」のようなタグ選択に使う。
 */
export function MultiChoiceGroup({
  label,
  hint,
  values,
  onToggle,
  options,
}: {
  label: string
  hint?: string
  values: string[]
  onToggle: (v: string) => void
  options: readonly string[]
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
      <span className="text-[14px] font-semibold text-text-ink">{label}</span>
      {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-text-ink/45">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip key={opt} active={values.includes(opt)} onClick={() => onToggle(opt)}>
            {opt}
          </Chip>
        ))}
      </div>
    </div>
  )
}
