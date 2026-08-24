import type { WindowCostEstimate } from '@/types'
import { formatCurrency } from '@/lib/format'
import { formatDateDot, weekdayJa } from '@/lib/time'

type Tone = 'light' | 'dark'

/**
 * 休暇期間の中で開始日をずらした場合の概算費用を、棒グラフで比較する。
 * 実料金 API には接続していないため、常に「推定」であることをラベルで明示する（29章の方針）。
 */
export function CostTimingChart({
  estimates,
  currency,
  selectedStart,
  onSelect,
  tone = 'light',
}: {
  estimates: WindowCostEstimate[]
  currency: string
  selectedStart?: string
  onSelect: (estimate: WindowCostEstimate) => void
  tone?: Tone
}) {
  if (estimates.length === 0) return null
  const max = Math.max(...estimates.map((e) => e.total))
  const min = Math.min(...estimates.map((e) => e.total))
  const range = Math.max(1, max - min)
  const dark = tone === 'dark'

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={`label-caps ${dark ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}>
          時期による費用の推定
        </p>
        <p className={`mono-readout text-[10px] ${dark ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}>
          実料金ではなく概算です
        </p>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {estimates.map((e) => {
          const heightPct = 18 + ((e.total - min) / range) * 82
          const selected = e.startDate === selectedStart
          return (
            <button
              key={e.startDate}
              onClick={() => onSelect(e)}
              className={`flex w-[64px] shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 pt-3 text-center transition duration-200 ease-passage ${
                selected
                  ? 'border-brass bg-brass/15'
                  : dark
                    ? 'border-white/15 hover:border-white/35'
                    : 'border-black/8 hover:border-black/20'
              }`}
            >
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={`w-5 rounded-t-md transition-[height] duration-300 ease-passage ${
                    e.isCheapest ? 'bg-brass' : dark ? 'bg-white/25' : 'bg-ink/25'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={`mono-readout text-[10px] ${dark ? 'text-text-porcelain/60' : 'text-text-ink/65'}`}>
                {formatDateDot(e.startDate).slice(5)}
              </span>
              <span className={`mono-readout text-[9px] ${dark ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}>
                {weekdayJa(e.startDate)}
              </span>
              {e.isCheapest && (
                <span className="label-caps rounded-full bg-brass px-1.5 py-0.5 text-[8px] text-ink">
                  最安
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedStart && (
        <SelectedSummary
          estimate={estimates.find((e) => e.startDate === selectedStart)}
          currency={currency}
          tone={tone}
        />
      )}
    </div>
  )
}

function SelectedSummary({
  estimate,
  currency,
  tone,
}: {
  estimate: WindowCostEstimate | undefined
  currency: string
  tone: Tone
}) {
  if (!estimate) return null
  const dark = tone === 'dark'
  return (
    <div className={`mt-3 rounded-xl p-3 ${dark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
      <p className={`mono-readout text-[13px] font-semibold ${dark ? 'text-text-porcelain' : 'text-text-ink'}`}>
        {formatCurrency(estimate.total, currency)}
        <span className={`ml-1.5 text-[11px] font-normal ${dark ? 'text-text-porcelain/55' : 'text-text-ink/65'}`}>
          （{estimate.seasonLabel} · 1泊あたり約 {formatCurrency(estimate.perNightAverage, currency)}）
        </span>
      </p>
    </div>
  )
}
