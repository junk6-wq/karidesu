import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { StatReadout } from '@/components/common/StatReadout'
import { Thread } from '@/components/thread/Thread'
import { formatCurrency, formatKm } from '@/lib/format'
import { daysBetween, formatDuration } from '@/lib/time'
import { BUDGET_LABELS, BUDGET_ORDER, effectiveSpend, tripStats } from '@/lib/tripStats'

/**
 * S12 — Memory / Stats
 * 距離・費用・訪問数の data readout。装飾を足さず、数字だけで旅の重さを示す。
 */
export function MemoryStatsScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const spend = effectiveSpend(trip)
  const days = daysBetween(trip.startDate, trip.endDate) + 1
  const actual = trip.budget.actual ?? trip.budget.planned
  const maxCategory = Math.max(...BUDGET_ORDER.map((c) => actual[c]), 1)

  const stayMinutes = trip.itinerary
    .flatMap((d) => d.items)
    .reduce((sum, item) => sum + (trip.spots.find((s) => s.id === item.spotId)?.estimatedStayMin ?? 60), 0)

  const categories = new Map<string, number>()
  trip.itinerary
    .flatMap((d) => d.items)
    .forEach((item) => {
      const spot = trip.spots.find((s) => s.id === item.spotId)
      if (!spot) return
      categories.set(spot.category, (categories.get(spot.category) ?? 0) + 1)
    })

  return (
    <div className="mx-auto max-w-[820px] px-6 pb-28 pt-8">
      <Link
        to={`/trip/${trip.id}/memory`}
        className="tap label-caps -ml-2 inline-flex items-center rounded-full px-2 text-text-porcelain/55"
      >
        ← TRAVELOGUE
      </Link>

      <h1 className="font-display text-display-l mt-5">この旅の記録</h1>
      <div className="mt-6">
        <Thread variant="memory" progress={1} showHead={false} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3">
        <StatReadout label="DAYS" value={days} tone="dark" size="l" />
        <StatReadout label="DISTANCE" value={formatKm(stats.distanceKm)} tone="dark" size="l" />
        <StatReadout label="SPOTS" value={stats.itemCount} tone="dark" size="l" />
        <StatReadout
          label="TOTAL SPENT"
          value={formatCurrency(spend, trip.budget.currency)}
          tone="dark"
          size="l"
        />
        <StatReadout
          label="PER DAY"
          value={formatCurrency(spend / Math.max(1, days), trip.budget.currency)}
          tone="dark"
          size="l"
        />
        <StatReadout
          label="PER PERSON"
          value={formatCurrency(spend / Math.max(1, trip.companions.length), trip.budget.currency)}
          tone="dark"
          size="l"
        />
        <StatReadout label="TIME ON SPOT" value={formatDuration(stayMinutes)} tone="dark" size="l" />
        <StatReadout
          label="AVG / DAY"
          value={`${(stats.itemCount / Math.max(1, days)).toFixed(1)} SPOTS`}
          tone="dark"
          size="l"
        />
        <StatReadout label="COMPANIONS" value={trip.companions.length} tone="dark" size="l" />
      </div>

      {/* 費用の内訳 */}
      <section className="mt-16">
        <p className="label-caps text-text-porcelain/45">SPENT BY CATEGORY</p>
        <ul className="mt-5 space-y-4">
          {BUDGET_ORDER.map((c) => (
            <li key={c}>
              <div className="mono-readout flex items-baseline justify-between text-[12px]">
                <span className="text-text-porcelain/70">{BUDGET_LABELS[c]}</span>
                <span>{formatCurrency(actual[c], trip.budget.currency)}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-700 ease-passage"
                  style={{ width: `${(actual[c] / maxCategory) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 何を見て回ったか */}
      {categories.size > 0 && (
        <section className="mt-14">
          <p className="label-caps text-text-porcelain/45">WHAT WE SAW</p>
          <ul className="mono-readout mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
            {[...categories.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <li key={name} className="text-text-porcelain/70">
                  {name} <span className="text-brass">{count}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="mono-readout mt-16 text-[11px] leading-relaxed text-text-porcelain/30">
        距離はスポット間の直線距離の合計です（MVP の近似）。実経路 API を繋ぐと実走行距離に置き換わります。
      </p>
    </div>
  )
}
