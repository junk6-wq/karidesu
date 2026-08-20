import type { ItineraryDay, Spot } from '@/types'
import { Photo } from '@/components/common/Photo'
import { formatDateDot, formatDuration, weekdayEn } from '@/lib/time'

/**
 * AI が組み上げたモデルプランを、日ごとに一通り見せる画面。
 * 各予定は「変える」から別の候補に差し替えられる（すでに行ったことがある
 * 場所を外して、別の選択肢に置き換えるための導線）。
 *
 * 予定を削って減らすのではなく差し替えなので、旅程は完成した状態のまま保たれる。
 * 判断材料として写真は大きめに出す（小さなサムネイルだけだと画面が暗くなり、
 * 行くかどうかも判断できないため）。
 */
export function ModelPlanReview({
  itinerary,
  spots,
  onSwapRequest,
  onFinish,
  busy = false,
}: {
  itinerary: ItineraryDay[]
  spots: Spot[]
  onSwapRequest: (itemId: string, current: Spot) => void
  onFinish: () => void
  busy?: boolean
}) {
  const spotById = new Map(spots.map((s) => [s.id, s]))
  const itemCount = itinerary.reduce((sum, d) => sum + d.items.length, 0)

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-7">
        {itinerary.map((day, dayIndex) => (
          <section key={day.id}>
            <div className="flex items-baseline gap-2">
              <h2 className="mono-readout text-[13px] text-brass">
                DAY {String(dayIndex + 1).padStart(2, '0')}
              </h2>
              <span className="mono-readout text-[11px] text-text-porcelain/45">
                {formatDateDot(day.date)} {weekdayEn(day.date)}
              </span>
              <span className="mono-readout ml-auto text-[11px] text-text-porcelain/35">
                {day.items.length} 件
              </span>
            </div>

            {day.items.length === 0 ? (
              <p className="mt-2 text-[12px] text-text-porcelain/35">この日は空です。</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {day.items.map((item) => {
                  const spot = spotById.get(item.spotId)
                  if (!spot) return null
                  return (
                    <li
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06]"
                    >
                      <Photo
                        src={spot.photoUrls[0]}
                        alt={spot.name}
                        seed={spot.name}
                        className="aspect-[16/9] w-full"
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                        <span className="label-caps absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-text-porcelain/85">
                          {spot.category}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 p-3.5">
                          <p className="mono-readout text-[11px] text-brass">
                            {item.plannedArrival ?? '--:--'}
                            {item.plannedDeparture && (
                              <span className="text-text-porcelain/50"> → {item.plannedDeparture}</span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-[17px] font-semibold text-text-porcelain">
                            {spot.name}
                          </p>
                          <p className="mono-readout mt-0.5 text-[11px] text-text-porcelain/60">
                            滞在 {formatDuration(spot.estimatedStayMin ?? 60)}
                            {spot.openingHours ? ` · ${spot.openingHours}` : ''}
                          </p>
                        </div>
                      </Photo>

                      <button
                        onClick={() => onSwapRequest(item.id, spot)}
                        className="tap flex w-full items-center justify-center gap-2 border-t border-white/10 text-[13px] text-text-porcelain/70 transition duration-200 ease-passage hover:bg-white/10 hover:text-text-porcelain"
                      >
                        ここは別の場所に変える
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <button
        onClick={onFinish}
        disabled={busy}
        className="tap mt-8 flex w-full items-center justify-center rounded-full bg-brass px-6 text-[15px] font-semibold text-ink shadow-card transition duration-200 ease-passage hover:brightness-110 disabled:opacity-50"
      >
        {busy ? '組み立てています…' : `このプランでつくる（${itemCount}件）`}
      </button>
    </div>
  )
}
