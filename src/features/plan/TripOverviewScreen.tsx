import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { StatReadout } from '@/components/common/StatReadout'
import { LinkButton } from '@/components/common/Button'
import { MapLayer } from '@/components/map/MapLayer'
import { formatCurrency, formatKm } from '@/lib/format'
import { daysUntil, formatDateRange, weekdayEn } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'
import { modesFor } from '@/features/trip/modes'

/**
 * S03 — Trip Overview（表紙）
 * 旅程表ではなく、旅全体のビジュアルサマリー。
 */
export function TripOverviewScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const until = daysUntil(trip.startDate)
  const modes = modesFor(trip)
  const journey = modes.find((m) => m.id === 'journey')

  return (
    <div className="pb-24">
      <Photo
        src={trip.coverPhotoUrl}
        alt={`${trip.destination}の表紙写真`}
        seed={trip.title}
        className="h-[46vh] min-h-[280px] w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-stone via-stone/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <p className="mono-readout text-[12px] text-text-ink/60">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.destination}
          </p>
          <h1 className="font-display text-display-xl mt-1">{trip.title}</h1>
        </div>
      </Photo>

      <div className="mx-auto max-w-[1200px] px-5">
        {/* 出発カウントダウン */}
        {until > 0 && (
          <div className="mt-6 flex items-center gap-4 rounded-card border border-black/10 bg-white/70 p-5">
            <span className="mono-readout text-[34px] leading-none text-brass">D-{until}</span>
            <span className="text-[13px] leading-relaxed text-text-ink/60">
              出発まであと {until} 日。<br />
              当日になると JOURNEY モードが自動で開きます。
            </span>
          </div>
        )}
        {until <= 0 && journey?.unlocked && (
          <Link
            to={`/trip/${trip.id}/journey`}
            className="mt-6 flex items-center justify-between gap-4 rounded-card bg-ink p-5 text-text-porcelain"
          >
            <span>
              <span className="label-caps text-brass">ON THE JOURNEY</span>
              <span className="mt-1 block text-[15px]">いま、この旅の中にいます</span>
            </span>
            <span className="mono-readout text-brass">→</span>
          </Link>
        )}

        <div className="mt-7 text-text-ink/25">
          <Thread variant="plan" progress={stats.progress} showHead={stats.progress > 0} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatReadout label="DAYS" value={stats.dayCount} />
          <StatReadout label="DISTANCE" value={formatKm(stats.distanceKm)} />
          <StatReadout label="SPOTS" value={stats.itemCount} />
          <StatReadout
            label="BUDGET"
            value={formatCurrency(stats.plannedTotal, trip.budget.currency)}
          />
        </div>

        {/* 旅の骨格 */}
        <section className="mt-11 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h2 className="label-caps text-text-ink/45">ROUTE</h2>
            <div className="mt-3 overflow-hidden rounded-card border border-black/10">
              <MapLayer
                markers={trip.itinerary.flatMap((day) =>
                  day.items.flatMap((item) => {
                    const spot = trip.spots.find((s) => s.id === item.spotId)
                    return spot
                      ? [
                          {
                            id: item.id,
                            position: spot.location,
                            label: spot.name,
                            state: item.actualArrival ? ('done' as const) : ('future' as const),
                          },
                        ]
                      : []
                  }),
                )}
                progress={stats.progress}
                className="h-[320px] w-full"
                interactive={false}
              />
            </div>
          </div>

          <div>
            <h2 className="label-caps text-text-ink/45">DAYS</h2>
            <ol className="mt-3 space-y-2">
              {trip.itinerary.map((day, i) => {
                const names = day.items
                  .map((it) => trip.spots.find((s) => s.id === it.spotId)?.name)
                  .filter(Boolean)
                return (
                  <li key={day.id}>
                    <Link
                      to={`/trip/${trip.id}/plan/itinerary#${day.id}`}
                      className="flex items-start gap-4 rounded-2xl border border-black/8 bg-white/60 p-4 transition duration-200 ease-passage hover:border-black/20"
                    >
                      <span className="mono-readout shrink-0 text-[12px] text-brass">
                        DAY {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mono-readout block text-[11px] text-text-ink/40">
                          {day.date.slice(5).replace('-', '.')} {weekdayEn(day.date)}
                        </span>
                        <span className="mt-1 block truncate text-[14px]">
                          {names.length ? names.join(' → ') : 'まだ予定がありません'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton to={`/trip/${trip.id}/plan/itinerary`} variant="primary">
            旅程をひらく
          </LinkButton>
          <LinkButton to={`/trip/${trip.id}/plan/spots`}>スポット</LinkButton>
          <LinkButton to={`/trip/${trip.id}/plan/budget`}>予算</LinkButton>
          <LinkButton to={`/trip/${trip.id}/agent`}>AI と組み立てる</LinkButton>
        </div>
      </div>
    </div>
  )
}
