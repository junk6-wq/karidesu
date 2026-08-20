import type { ItineraryDay, Spot, TripContext } from '@/types'
import { Photo } from '@/components/common/Photo'
import { PACE_CAPACITY } from '@/lib/providers/mockAgent'
import { formatDateDot, formatDuration, weekdayEn } from '@/lib/time'

const LOAD_DOT = { low: '🟢', medium: '🟠', high: '🔴' } as const

/** 快適な件数からどれだけ超えているかで🟢🟠🔴を決める（1件超過=🟠、2件以上=🔴）。 */
function loadLevelFor(count: number, capacity: number): keyof typeof LOAD_DOT {
  if (count === 0) return 'low'
  const over = count - capacity
  if (over >= 2) return 'high'
  if (over >= 1) return 'medium'
  return 'low'
}

/**
 * AI が組み立てた旅程をそのまま見せて、詰め込みすぎたところを外して調整する画面。
 * 「行きたい場所を選んでから組み立てる」のではなく「先に組み立てて、余分を外す」
 * 順番にする（12章）。suggestSpots は overshoot 指定で少し多めに候補を取っており、
 * その分そのまま日に詰め込むと選んだペースの快適な件数を超えやすいので、
 * どこを外せばいいかが分かりやすい。
 *
 * 詰め込み判定は移動時間を含む一般的な DayLoad ではなく、単純な件数 vs
 * ペースの快適件数で行う。この段階の旅程はまだ runOptimize
 * （移動区間の計算）を通っていないため、移動時間に依存する指標は
 * 常にゼロになってしまい判定として機能しない。
 */
export function DraftItineraryReview({
  itinerary,
  spots,
  pace,
  onRemoveItem,
  onFinish,
  busy = false,
}: {
  itinerary: ItineraryDay[]
  spots: Spot[]
  pace: TripContext['pace']
  onRemoveItem: (dayId: string, itemId: string) => void
  onFinish: () => void
  busy?: boolean
}) {
  const spotById = new Map(spots.map((s) => [s.id, s]))
  const capacity = PACE_CAPACITY[pace]
  const itemCount = itinerary.reduce((sum, d) => sum + d.items.length, 0)
  const overloadedCount = itinerary.filter((d) => loadLevelFor(d.items.length, capacity) !== 'low').length

  return (
    <div className="flex flex-1 flex-col">
      {overloadedCount > 0 ? (
        <p className="rounded-2xl border border-[color:var(--c-amber)]/35 bg-[color:var(--c-amber)]/12 p-3.5 text-[13px] leading-relaxed text-[color:var(--c-amber)]">
          {overloadedCount} 日、少し詰め込み気味です。🟠🔴 の日から外したい場所を選んでください。
        </p>
      ) : (
        <p className="rounded-2xl border border-brass/30 bg-brass/10 p-3.5 text-[13px] leading-relaxed text-brass">
          ちょうどいいペースです。このまま作ってもいいですし、さらに外しても構いません。
        </p>
      )}

      <div className="mt-5 space-y-6">
        {itinerary.map((day, dayIndex) => {
          const level = loadLevelFor(day.items.length, capacity)
          return (
            <div key={day.id}>
              <div className="flex items-center gap-2">
                <h2 className="mono-readout text-[13px] text-brass">
                  DAY {String(dayIndex + 1).padStart(2, '0')}
                </h2>
                <span className="mono-readout text-[11px] text-text-porcelain/40">
                  {formatDateDot(day.date)} {weekdayEn(day.date)}
                </span>
                {day.items.length > 0 && (
                  <span className="mono-readout ml-auto text-[11px] text-text-porcelain/50">
                    {LOAD_DOT[level]} {day.items.length} / {capacity}
                  </span>
                )}
              </div>

              {day.items.length === 0 ? (
                <p className="mt-2 text-[12px] text-text-porcelain/35">この日は空です。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.items.map((item) => {
                    const spot = spotById.get(item.spotId)
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2"
                      >
                        <Photo
                          src={spot?.photoUrls[0]}
                          alt={spot?.name ?? '予定'}
                          seed={spot?.name}
                          className="h-14 w-16 shrink-0 rounded-xl"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="mono-readout block text-[10px] text-text-porcelain/45">
                            {item.plannedArrival}
                            {item.plannedDeparture && ` → ${item.plannedDeparture}`}
                          </span>
                          <span className="block truncate text-[14px] font-semibold text-text-porcelain">
                            {spot?.name ?? '不明なスポット'}
                          </span>
                          <span className="mono-readout block text-[10px] text-text-porcelain/40">
                            滞在 {formatDuration(spot?.estimatedStayMin ?? 60)}
                          </span>
                        </span>
                        <button
                          onClick={() => onRemoveItem(day.id, item.id)}
                          aria-label={`${spot?.name ?? '予定'}を外す`}
                          className="tap shrink-0 rounded-full px-3 text-[12px] text-text-porcelain/45 hover:bg-white/10 hover:text-text-porcelain"
                        >
                          外す
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={onFinish}
        disabled={busy}
        className="tap mt-7 flex w-full items-center justify-center rounded-full bg-brass px-6 text-[15px] font-semibold text-ink shadow-card transition duration-200 ease-passage hover:brightness-110 disabled:opacity-50"
      >
        {busy ? '組み立てています…' : `この旅をつくる（${itemCount}件）`}
      </button>
    </div>
  )
}
