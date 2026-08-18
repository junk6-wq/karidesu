import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { buildContext, useJourneyStore } from '@/store/journeyStore'
import { MapLayer } from '@/components/map/MapLayer'
import { StatReadout } from '@/components/common/StatReadout'
import { Thread } from '@/components/thread/Thread'
import { TodayTimeline } from '@/components/journey/TodayTimeline'
import { formatDuration, toISODate } from '@/lib/time'
import { formatKm } from '@/lib/format'
import { haversineKm } from '@/lib/geo'

/**
 * S09 — Journey / Full Route
 * 全体地図・現在地・遅延状況。Next 画面で畳んだ情報をここだけで開く。
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
  const day = trip.itinerary.find((d) => d.date === todayISO) ?? trip.itinerary[0]

  const markers = (day?.items ?? []).flatMap((item) => {
    const spot = trip.spots.find((s) => s.id === item.spotId)
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
  })

  const remainingKm = markers
    .slice(markers.findIndex((m) => m.state === 'next'))
    .reduce((sum, m, i, arr) => (i === 0 ? sum : sum + haversineKm(arr[i - 1].position, m.position)), 0)

  const progress = ctx.todayItems.length ? ctx.doneCount / ctx.todayItems.length : 1

  return (
    <div className="min-h-dvh bg-ink text-text-porcelain">
      <header className="flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <Link
          to={`/trip/${trip.id}/journey`}
          className="tap label-caps -ml-2 flex items-center rounded-full px-2 text-text-porcelain/55"
        >
          ← NEXT
        </Link>
        <span className="label-caps text-text-porcelain/45">FULL ROUTE</span>
      </header>

      <div className="mt-5 overflow-hidden">
        <MapLayer
          markers={markers}
          progress={progress}
          current={ctx.state.currentLocation}
          className="h-[52dvh] w-full"
        />
      </div>

      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <div className="text-text-porcelain">
          <Thread variant="journey" progress={progress} status={ctx.state.status} showHead />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <StatReadout label="DONE" value={`${ctx.doneCount}/${ctx.todayItems.length}`} tone="dark" />
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

        <TodayTimeline
          items={day?.items ?? []}
          spots={trip.spots}
          nextItemId={ctx.nextItem?.id}
          className="mt-8"
        />

        {!ctx.state.currentLocation && (
          <p className="mono-readout mt-8 text-[11px] leading-relaxed text-text-porcelain/35">
            現在地が取得できていません。位置情報を許可するか、Next 画面の「遅れそう」から手動で報告できます。
          </p>
        )}
      </div>
    </div>
  )
}
