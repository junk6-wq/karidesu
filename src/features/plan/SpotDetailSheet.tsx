import { useMemo, useState } from 'react'
import type { BudgetCategory, ItineraryItemType, Spot } from '@/types'
import { BottomSheet } from '@/components/common/Sheet'
import { Button } from '@/components/common/Button'
import { Chip, QuestChip } from '@/components/common/QuestChip'
import { Photo } from '@/components/common/Photo'
import { useTrip, useTripWarnings, useTripsStore } from '@/store/tripsStore'
import { formatDuration } from '@/lib/time'
import { formatCurrency, formatKm } from '@/lib/format'
import { haversineKm } from '@/lib/geo'
import { BUDGET_LABELS, BUDGET_ORDER } from '@/lib/tripStats'
import { spotSeeds } from '@/lib/providers/spotSeeds'

const TYPES: { value: ItineraryItemType; label: string }[] = [
  { value: 'sightseeing', label: '観光' },
  { value: 'meal', label: '食事' },
  { value: 'stay', label: '宿泊' },
  { value: 'transit', label: '移動' },
]

/**
 * S05 — Spot Detail / AI 提案
 * 予定の中身を直接いじれる場所。AI は「近くの代替」を提案する。
 */
export function SpotDetailSheet({
  tripId,
  itemId,
  onClose,
}: {
  tripId: string
  itemId: string
  onClose: () => void
}) {
  const trip = useTrip(tripId)
  const warnings = useTripWarnings(tripId).filter((w) => w.itemId === itemId)
  const { updateItem, removeItem, moveItemToDay, addSpot, runOptimize } = useTripsStore()
  const [showAlternatives, setShowAlternatives] = useState(false)

  const item = trip?.itinerary.flatMap((d) => d.items).find((i) => i.id === itemId)
  const day = trip?.itinerary.find((d) => d.items.some((i) => i.id === itemId))
  const spot = trip?.spots.find((s) => s.id === item?.spotId)

  /** 同じ土地の種データから、いま選んでいる場所に近い代替を出す。 */
  const alternatives = useMemo(() => {
    if (!trip || !spot) return []
    const pool = Object.values(spotSeeds).flat()
    const usedNames = new Set(trip.spots.map((s) => s.name))
    return pool
      .filter((s) => !usedNames.has(s.name))
      .map((s) => ({ seed: s, km: haversineKm(spot.location, s.location) }))
      .filter((x) => x.km < 90)
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
  }, [trip, spot])

  if (!trip || !item || !day) return null

  function replaceWith(seedIndex: number) {
    const alt = alternatives[seedIndex]
    if (!alt) return
    const created = addSpot(tripId, {
      name: alt.seed.name,
      category: alt.seed.category,
      location: alt.seed.location,
      photoUrls: alt.seed.photoUrls,
      openingHours: alt.seed.openingHours,
      closedDays: alt.seed.closedDays,
      estimatedStayMin: alt.seed.estimatedStayMin,
      priceLevel: alt.seed.priceLevel,
      aiRecommended: true,
      source: 'ai',
    })
    updateItem(tripId, itemId, { spotId: created.id })
    void runOptimize(tripId)
    setShowAlternatives(false)
  }

  return (
    <BottomSheet open onClose={onClose} title={spot?.name ?? '予定'}>
      <Photo
        src={spot?.photoUrls[0]}
        alt={spot?.name ?? '予定'}
        className="mb-5 aspect-[16/9] w-full rounded-2xl"
      />

      {warnings.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {warnings.map((w, i) => (
            <QuestChip key={i} severity={w.severity}>
              {w.message}
            </QuestChip>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TimeField
          label="到着"
          value={item.plannedArrival ?? ''}
          onChange={(v) => {
            updateItem(tripId, itemId, { plannedArrival: v })
            void runOptimize(tripId)
          }}
        />
        <TimeField
          label="出発"
          value={item.plannedDeparture ?? ''}
          onChange={(v) => {
            updateItem(tripId, itemId, { plannedDeparture: v })
            void runOptimize(tripId)
          }}
        />
      </div>

      <p className="label-caps mt-6 text-text-ink/65">種類</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Chip
            key={t.value}
            active={item.type === t.value}
            onClick={() => updateItem(tripId, itemId, { type: t.value })}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <p className="label-caps mt-6 text-text-ink/65">日を移す</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {trip.itinerary.map((d, i) => (
          <Chip
            key={d.id}
            active={d.id === day.id}
            onClick={() => {
              moveItemToDay(tripId, itemId, d.id)
              void runOptimize(tripId)
            }}
          >
            DAY {String(i + 1).padStart(2, '0')}
          </Chip>
        ))}
      </div>

      <p className="label-caps mt-6 text-text-ink/65">費用</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          aria-label="費用（円）"
          value={item.cost ?? ''}
          placeholder="0"
          onChange={(e) =>
            updateItem(tripId, itemId, {
              cost: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          className="mono-readout w-32 rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-brass"
        />
        <select
          value={item.costCategory ?? 'activity'}
          onChange={(e) =>
            updateItem(tripId, itemId, { costCategory: e.target.value as BudgetCategory })
          }
          className="rounded-xl border border-black/12 bg-white px-3 py-2.5 text-[14px] focus:border-brass"
        >
          {BUDGET_ORDER.map((c) => (
            <option key={c} value={c}>
              {BUDGET_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <label className="mt-6 block">
        <span className="label-caps text-text-ink/65">メモ</span>
        <textarea
          value={item.notes ?? ''}
          onChange={(e) => updateItem(tripId, itemId, { notes: e.target.value })}
          rows={3}
          placeholder="予約番号、駐車場、持ち物など"
          className="mt-2 w-full resize-none rounded-xl border border-black/12 bg-white px-3 py-2.5 text-[14px] placeholder:text-text-ink/65 focus:border-brass"
        />
      </label>

      {spot && (
        <dl className="mono-readout mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-black/[0.04] p-4 text-[12px]">
          <Meta label="CATEGORY" value={spot.category} />
          <Meta label="STAY" value={formatDuration(spot.estimatedStayMin ?? 60)} />
          <Meta label="HOURS" value={spot.openingHours ?? '—'} />
          <Meta label="CLOSED" value={spot.closedDays?.join('・') ?? '—'} />
          <Meta
            label="PRICE"
            value={spot.priceLevel ? '¥'.repeat(spot.priceLevel) : '—'}
          />
          <Meta
            label="COORD"
            value={`${spot.location.lat.toFixed(3)}, ${spot.location.lng.toFixed(3)}`}
          />
        </dl>
      )}

      {/* AI 提案 */}
      <div className="mt-6 rounded-2xl border border-brass/35 bg-brass/[0.07] p-4">
        <p className="label-caps text-[#7a5f2b]">AI の提案</p>
        {!showAlternatives ? (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-text-ink/70">
              この予定に近い場所を {alternatives.length} 件見つけています。
              入れ替えると移動時間と警告も組み直します。
            </p>
            <Button
              className="mt-3"
              disabled={alternatives.length === 0}
              onClick={() => setShowAlternatives(true)}
            >
              代替を見る
            </Button>
          </>
        ) : (
          <ul className="mt-3 space-y-2">
            {alternatives.map((alt, i) => (
              <li key={alt.seed.name}>
                <button
                  onClick={() => replaceWith(i)}
                  className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white p-2 text-left transition duration-200 ease-passage hover:border-brass"
                >
                  <Photo
                    src={alt.seed.photoUrls[0]}
                    alt={alt.seed.name}
                    className="h-12 w-16 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {alt.seed.name}
                    </span>
                    <span className="mono-readout mt-0.5 block text-[11px] text-text-ink/65">
                      {alt.seed.category} · {formatKm(alt.km)}
                    </span>
                  </span>
                  <span className="mono-readout text-brass">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        {item.cost ? (
          <span className="mono-readout text-[13px] text-text-ink/65">
            {formatCurrency(item.cost, trip.budget.currency)}
          </span>
        ) : (
          <span />
        )}
        <Button
          variant="destructive"
          onClick={() => {
            removeItem(tripId, itemId)
            onClose()
          }}
        >
          この予定を削除
        </Button>
      </div>
    </BottomSheet>
  )
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="label-caps text-text-ink/65">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mono-readout mt-2 w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-brass"
      />
    </label>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps text-text-ink/65">{label}</dt>
      <dd className="mt-0.5 truncate">{value}</dd>
    </div>
  )
}

export type { Spot }
