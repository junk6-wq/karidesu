import type { ItineraryItem, Spot } from '@/types'
import { formatDuration } from '@/lib/time'

/**
 * 今日の予定を縦に並べたタイムライン。
 * JOURNEY / Next と JOURNEY / Full Route の両方で使う共通表示。
 * 「次の予定しか見えない」問題を解消するため、常時展開した状態で使うことを想定している。
 */
export function TodayTimeline({
  items,
  spots,
  nextItemId,
  className = '',
  dense = false,
}: {
  items: ItineraryItem[]
  spots: Spot[]
  nextItemId?: string
  className?: string
  dense?: boolean
}) {
  const spotById = new Map(spots.map((s) => [s.id, s]))

  return (
    <ul className={`${dense ? 'space-y-2' : 'space-y-3'} ${className}`}>
      {items.map((item) => {
        const spot = spotById.get(item.spotId)
        const done = Boolean(item.actualArrival)
        const isNext = item.id === nextItemId
        return (
          <li key={item.id} className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                done || isNext ? 'border-brass bg-brass' : 'border-white/30'
              } ${isNext ? 'ring-4 ring-brass/25' : ''}`}
            />
            <span className="mono-readout w-11 shrink-0 text-[11px] text-text-porcelain/45">
              {item.actualArrival ?? item.plannedArrival ?? '--:--'}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-[14px] ${
                done
                  ? 'text-text-porcelain/40 line-through'
                  : isNext
                    ? 'font-semibold text-brass'
                    : 'text-text-porcelain/85'
              }`}
            >
              {spot?.name ?? '—'}
            </span>
            {item.travelToNext && (
              <span className="mono-readout shrink-0 text-[11px] text-text-porcelain/35">
                {formatDuration(item.travelToNext.durationMin)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
