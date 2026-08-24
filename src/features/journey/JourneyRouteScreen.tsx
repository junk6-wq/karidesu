import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { buildContext, useJourneyStore } from '@/store/journeyStore'
import { MapLayer } from '@/components/map/MapLayer'
import { StatReadout } from '@/components/common/StatReadout'
import { Thread } from '@/components/thread/Thread'
import { TodayTimeline } from '@/components/journey/TodayTimeline'
import { formatDateDot, formatDuration, toISODate, weekdayEn } from '@/lib/time'
import { formatKm } from '@/lib/format'
import { haversineKm } from '@/lib/geo'

/**
 * S09 — Journey / 全日程
 * Next 画面が「今と次」に集中する分、こちらで旅の全工程を通して見られるようにする。
 * 地図は全日分の経路、下は DAY ごとのタイムライン。今日の DAY は強調する。
 */
export function JourneyRouteScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const states = useJourneyStore((s) => s.states)
  const manualDelay = useJourneyStore((s) => s.manualDelay)

  const ctx = useMemo(() => {
    if (!trip || !id) return undefined
    const state = states[id] ?? {
      tripId: id,
      delayMinutes: 0,
      status: 'on_time' as const,
      lastUpdated: '',
    }
    return buildContext(trip, state, manualDelay[id] ?? 0)
  }, [trip, id, states, manualDelay])

  if (!trip || !id || !ctx) return <Navigate to="/" replace />

  const todayISO = toISODate(new Date())
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))

  // 地図は旅の全行程。今日以降の予定は future、到着済みは done で塗り分ける
  const markers = trip.itinerary.flatMap((day) =>
    day.items.flatMap((item) => {
      const spot = spotById.get(item.spotId)
      if (!spot) return []
      return [
        {
          id: item.id,
          position: spot.location,
          label: spot.name,
          state: item.actualArrival
            ? ('done' as const)
            : item.id === ctx.nextItem?.id
              ? ('next' as const)
              : ('future' as const),
        },
      ]
    }),
  )

  const allItems = trip.itinerary.flatMap((d) => d.items)
  const doneAll = allItems.filter((i) => i.actualArrival).length
  const tripProgressRatio = allItems.length ? doneAll / allItems.length : 0

  // 残り距離は「次の予定から最後まで」を旅程順に足す
  const nextIndex = markers.findIndex((m) => m.state === 'next')
  const remainingKm =
    nextIndex < 0
      ? 0
      : markers
          .slice(nextIndex)
          .reduce((sum, m, i, arr) => (i === 0 ? sum : sum + haversineKm(arr[i - 1].position, m.position)), 0)

  return (
    <div className="min-h-dvh bg-ink text-text-porcelain">
      <header className="flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <Link
          to={`/trip/${trip.id}/journey`}
          className="tap label-caps -ml-2 flex items-center rounded-full px-2 text-text-porcelain/55"
        >
          ← NEXT
        </Link>
        <span className="label-caps text-text-porcelain/55">全日程</span>
      </header>

      <div className="mt-5 overflow-hidden">
        <MapLayer
          markers={markers}
          progress={tripProgressRatio}
          current={ctx.state.currentLocation}
          className="h-[42dvh] w-full"
        />
      </div>

      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <div className="text-text-porcelain">
          <Thread variant="journey" progress={tripProgressRatio} status={ctx.state.status} showHead />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <StatReadout label="DONE" value={`${doneAll}/${allItems.length}`} tone="dark" />
          <StatReadout label="REMAINING" value={formatKm(remainingKm)} tone="dark" />
          <StatReadout
            label="DELAY"
            value={
              ctx.state.delayMinutes > 0 ? (
                <span
                  className={ctx.state.status === 'delayed' ? 'text-brick' : 'text-[color:var(--c-amber)]'}
                >
                  +{formatDuration(ctx.state.delayMinutes)}
                </span>
              ) : (
                <span className="text-brass">ON TIME</span>
              )
            }
            tone="dark"
          />
        </div>

        {/* 旅の全工程。今日だけでなく前後の日も通して見られるようにする */}
        <div className="mt-8 space-y-6">
          {trip.itinerary.map((day, dayIndex) => {
            const isToday = day.date === todayISO
            const isPast = day.date < todayISO
            const dayDone = day.items.filter((i) => i.actualArrival).length
            return (
              <section
                key={day.id}
                className={`rounded-card border p-4 ${
                  isToday ? 'border-brass/45 bg-brass/[0.07]' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h2 className="mono-readout text-[13px] text-brass">
                    DAY {String(dayIndex + 1).padStart(2, '0')}
                  </h2>
                  <span className="mono-readout text-[11px] text-text-porcelain/55">
                    {formatDateDot(day.date)} {weekdayEn(day.date)}
                  </span>
                  {isToday && (
                    <span className="label-caps rounded-full bg-brass px-2 py-0.5 text-[9px] text-ink">
                      TODAY
                    </span>
                  )}
                  {day.items.length > 0 && (
                    <span
                      className={`mono-readout ml-auto text-[11px] ${
                        isPast || dayDone === day.items.length
                          ? 'text-text-porcelain/55'
                          : 'text-text-porcelain/55'
                      }`}
                    >
                      {dayDone}/{day.items.length}
                    </span>
                  )}
                </div>

                {day.items.length > 0 ? (
                  <TodayTimeline
                    items={day.items}
                    spots={trip.spots}
                    nextItemId={ctx.nextItem?.id}
                    className={`mt-3 ${isPast ? 'opacity-55' : ''}`}
                    dense
                  />
                ) : (
                  <p className="mt-2 text-[12px] text-text-porcelain/55">予定はありません。</p>
                )}
              </section>
            )
          })}
        </div>

        {!ctx.state.currentLocation && (
          <p className="mono-readout mt-8 text-[11px] leading-relaxed text-text-porcelain/55">
            現在地が取得できていません。位置情報を許可するか、Next 画面の「遅れそう」から手動で報告できます。
          </p>
        )}
      </div>
    </div>
  )
}
