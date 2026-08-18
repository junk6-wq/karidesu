import { Button } from '@/components/common/Button'

/**
 * 人数などの小さな整数値を増減させる行。TripCreateScreen の人数選択と同じ操作感。
 */
export function NumberStepper({
  label,
  hint,
  value,
  onChange,
  min = 1,
  max = 8,
  suffix,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-white/70 p-4">
      <span className="min-w-0">
        <span className="text-[14px] font-semibold text-text-ink">{label}</span>
        {hint && (
          <span className="mt-1 block text-[12px] leading-relaxed text-text-ink/50">{hint}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <Button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`${label}を減らす`}>
          −
        </Button>
        <span className="mono-readout w-10 text-center text-[16px]">
          {value}
          {suffix}
        </span>
        <Button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`${label}を増やす`}>
          ＋
        </Button>
      </span>
    </div>
  )
}
