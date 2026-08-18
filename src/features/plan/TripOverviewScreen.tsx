import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip, useTripWarnings } from '@/store/tripsStore'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { StatReadout } from '@/components/common/StatReadout'
import { LinkButton } from '@/components/common/Button'
import { MapLayer } from '@/components/map/MapLayer'
import { formatCurrency, formatKm } from '@/lib/format'
import { daysUntil, formatDateRange, weekdayEn } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'
import { modesFor } from '@/features/trip/modes'
import { evaluateDayLoadSync, evaluateTripHealthSync, planCompleteness } from '@/lib/tripHealth'
import type { DayLoad, ItineraryWarning, Trip } from '@/types'

const HEALTH_LABELS: Record<string, string> = {
  moveEfficiency: '移動効率',
  openingHours: '営業時間',
  restMargin: '滞在余裕',
  budget: '予算',
  density: '旅程密度',
  weatherResilience: '天候耐性',
}

const LOAD_COLOR: Record<DayLoad['level'], string> = {
  low: 'var(--c-brass-gold)',
  medium: 'var(--c-amber)',
  high: 'var(--c-brick-coral)',
}

const LOAD_DOT: Record<DayLoad['level'], string> = { low: '🟢', medium: '🟠', high: '🔴' }

function nextActionText(trip: Trip, dayLoads: DayLoad[], warnings: ItineraryWarning[]): string {
  const emptyDayIndex = trip.itinerary.findIndex((d) => d.items.length === 0)
  if (emptyDayIndex !== -1) {
    return `DAY${emptyDayIndex + 1} にまだ予定がありません。スポットを追加しましょう。`
  }
  const risky = warnings.find((w) => w.severity === 'risk')
  if (risky) return risky.message

  const worst = [...dayLoads].sort((a, b) => b.score - a.score)[0]
  if (worst && worst.level === 'high') {
    const dayIndex = trip.itinerary.findIndex((d) => d.id === worst.dayId)
    return `DAY${dayIndex + 1} を少し調整すると、かなり良くなります。`
  }
  if (warnings.length > 0) return `気になる点が ${warnings.length} 件あります。AIで確認しましょう。`
  return '順調です。このまま準備を進めましょう。'
}

/**
 * S03 — Trip Overview（表紙）
 * 旅程表ではなく、旅全体のビジュアルサマリー。
 */
export function TripOverviewScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const warnings = useTripWarnings(id)
  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const until = daysUntil(trip.startDate)
  const modes = modesFor(trip)
  const journey = modes.find((m) => m.id === 'journey')

  const dayLoads = evaluateDayLoadSync(trip)
  const health = evaluateTripHealthSync(trip, warnings)
  const completeness = planCompleteness(trip, warnings)
  const nextAction = nextActionText(trip, dayLoads, warnings)

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

        {/* TRIP HEALTH: 旅を「情報表示」ではなく「問題解決」の起点にする */}
        <div className="mt-8 rounded-card border border-black/10 bg-white/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label-caps text-text-ink/45">TRIP HEALTH</p>
              <p className="font-display mt-1 leading-none">
                <span className="text-[42px]">{health.score}</span>
                <span className="ml-1 text-[15px] text-text-ink/40">/ 100</span>
              </p>
            </div>
            <LinkButton to={`/trip/${trip.id}/agent`} variant="primary">
              AIで改善
            </LinkButton>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Object.entries(health.breakdown).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <p className="label-caps truncate text-text-ink/35">{HEALTH_LABELS[key] ?? key}</p>
                <p className="mono-readout mt-0.5 text-[15px] text-text-ink">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-text-ink/65">
            <span>
              旅程 <b className="mono-readout text-brass">{completeness}%</b> 完成
            </span>
            <span>
              要確認{' '}
              <b className={`mono-readout ${warnings.length > 0 ? 'text-brick' : 'text-brass'}`}>
                {warnings.length}
              </b>{' '}
              件
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-text-ink/60">{nextAction}</p>
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
                const load = dayLoads.find((d) => d.dayId === day.id)
                return (
                  <li key={day.id}>
                    <Link
                      to={`/trip/${trip.id}/plan/itinerary#${day.id}`}
                      className="flex items-start gap-4 rounded-2xl border border-black/8 bg-white/60 p-4 transition duration-200 ease-passage hover:border-black/20"
                    >
                      <span className="flex shrink-0 flex-col items-start gap-1">
                        <span className="mono-readout text-[12px] text-brass">
                          DAY {String(i + 1).padStart(2, '0')}
                        </span>
                        {load && day.items.length > 0 && (
                          <span
                            className="mono-readout text-[11px]"
                            style={{ color: LOAD_COLOR[load.level] }}
                          >
                            {load.score} {LOAD_DOT[load.level]}
                          </span>
                        )}
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
