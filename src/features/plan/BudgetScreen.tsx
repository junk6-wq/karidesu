import { Navigate, useParams } from 'react-router-dom'
import type { BudgetCategory } from '@/types'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { StatReadout } from '@/components/common/StatReadout'
import { Button } from '@/components/common/Button'
import { formatCurrency } from '@/lib/format'
import { BUDGET_LABELS, BUDGET_ORDER } from '@/lib/tripStats'

/**
 * S06 — Budget
 * 計画と実績を横に並べ、差分を Brass / Coral で示す。
 */
export function BudgetScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { setPlannedBudget, setActualBudget } = useTripsStore()
  if (!trip || !id) return <Navigate to="/" replace />

  const planned = trip.budget.planned
  const actual = trip.budget.actual ?? { stay: 0, food: 0, transit: 0, activity: 0, other: 0 }
  const plannedTotal = BUDGET_ORDER.reduce((s, c) => s + planned[c], 0)
  const actualTotal = BUDGET_ORDER.reduce((s, c) => s + actual[c], 0)
  const diff = actualTotal - plannedTotal
  const people = trip.companions.length || 1

  /** 予定に入力済みの費用を実績へ取り込む。 */
  function pullFromItinerary() {
    const sums: Record<BudgetCategory, number> = {
      stay: 0,
      food: 0,
      transit: 0,
      activity: 0,
      other: 0,
    }
    trip!.itinerary.forEach((d) =>
      d.items.forEach((i) => {
        if (!i.cost) return
        sums[i.costCategory ?? 'activity'] += i.cost
      }),
    )
    BUDGET_ORDER.forEach((c) => setActualBudget(id!, c, sums[c]))
  }

  return (
    <div className="mx-auto max-w-[860px] px-5 pb-24 pt-6">
      <p className="label-caps text-text-ink/45">BUDGET</p>
      <h1 className="font-display text-display-m mt-1">予算</h1>

      <div className="mt-7 grid grid-cols-3 gap-4 rounded-card border border-black/10 bg-white/70 p-5">
        <StatReadout label="PLANNED" value={formatCurrency(plannedTotal, trip.budget.currency)} />
        <StatReadout label="ACTUAL" value={formatCurrency(actualTotal, trip.budget.currency)} />
        <StatReadout
          label="DIFF"
          value={
            <span className={diff > 0 ? 'text-brick' : diff < 0 ? 'text-brass' : undefined}>
              {diff > 0 ? '+' : ''}
              {formatCurrency(diff, trip.budget.currency)}
            </span>
          }
        />
      </div>

      <p className="mono-readout mt-3 text-[12px] text-text-ink/45">
        1人あたり {formatCurrency(plannedTotal / people, trip.budget.currency)} · {people} 名
      </p>

      <div className="mt-8 space-y-3">
        {BUDGET_ORDER.map((category) => {
          const share = plannedTotal > 0 ? planned[category] / plannedTotal : 0
          const over = actual[category] > planned[category] && planned[category] > 0
          return (
            <div
              key={category}
              className="rounded-2xl border border-black/8 bg-white/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold">{BUDGET_LABELS[category]}</span>
                <span className="mono-readout text-[11px] text-text-ink/40">
                  {Math.round(share * 100)}%
                </span>
              </div>

              {/* 配分バー。THE THREAD と同じ金で「確定した分」を示す */}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/8">
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-500 ease-passage"
                  style={{ width: `${Math.min(100, share * 100)}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <MoneyInput
                  label="計画"
                  value={planned[category]}
                  onChange={(v) => setPlannedBudget(id!, category, v)}
                />
                <MoneyInput
                  label="実績"
                  value={actual[category]}
                  tone={over ? 'over' : 'normal'}
                  onChange={(v) => setActualBudget(id!, category, v)}
                />
              </div>
            </div>
          )
        })}
      </div>

      <Button className="mt-6" onClick={pullFromItinerary}>
        旅程に入力した費用を実績に取り込む
      </Button>
    </div>
  )
}

function MoneyInput({
  label,
  value,
  onChange,
  tone = 'normal',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  tone?: 'normal' | 'over'
}) {
  return (
    <label className="block">
      <span className="label-caps text-text-ink/40">{label}</span>
      <span className="mt-1.5 flex items-center gap-1 rounded-xl border border-black/12 bg-white px-3 py-2 focus-within:border-brass">
        <span className="mono-readout text-text-ink/35">¥</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className={`mono-readout w-full bg-transparent text-right ${
            tone === 'over' ? 'text-brick' : ''
          }`}
        />
      </span>
    </label>
  )
}
