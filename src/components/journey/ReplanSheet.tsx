import type { ReplanSuggestion } from '@/types'
import { TopSheet } from '@/components/common/Sheet'
import { formatDuration } from '@/lib/time'

/**
 * S10 — Journey / Re-plan
 * モーダルで割り込まず、上部から静かに降りてくる。
 * 焦らせるのではなく、落ち着いて次の一手を示すトーン。
 */
export function ReplanSheet({
  open,
  headline,
  suggestions,
  loading,
  onAdopt,
  onDismiss,
}: {
  open: boolean
  headline: string
  suggestions: ReplanSuggestion[]
  loading: boolean
  onAdopt: (s: ReplanSuggestion) => void
  onDismiss: () => void
}) {
  return (
    <TopSheet open={open}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-caps text-[color:var(--c-amber)]">RE-PLAN</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{headline}</p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="閉じる"
            className="tap -mr-1 -mt-1 shrink-0 rounded-full text-text-porcelain/55 hover:text-text-porcelain"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="mt-4 flex gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 flex-1 animate-pulse rounded-2xl bg-white/8" />
            ))}
          </div>
        ) : (
          <ul className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {suggestions.map((s) => (
              <li key={s.id} className="w-[248px] shrink-0 snap-start">
                <button
                  onClick={() => onAdopt(s)}
                  className="flex h-full w-full flex-col rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 text-left transition duration-200 ease-passage hover:border-brass"
                >
                  <span className="text-[14px] font-semibold leading-snug">{s.title}</span>
                  <span className="mt-1.5 flex-1 text-[12px] leading-relaxed text-text-porcelain/60">
                    {s.detail}
                  </span>
                  <span className="mono-readout mt-3 text-[11px] text-brass">
                    {s.savedMinutes > 0 ? `− ${formatDuration(s.savedMinutes)}` : '予定は削らない'}
                    <span className="ml-2 text-text-porcelain/55">採用する →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TopSheet>
  )
}
