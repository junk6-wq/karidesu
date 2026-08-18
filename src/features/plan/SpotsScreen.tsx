import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { SpotPriority } from '@/types'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { Photo } from '@/components/common/Photo'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/QuestChip'
import { AddSpotSheet } from './AddSpotSheet'
import { formatDuration } from '@/lib/time'

const PRIORITY_OPTIONS: { value: SpotPriority; label: string }[] = [
  { value: 'must', label: 'MUST' },
  { value: 'want', label: 'WANT' },
  { value: 'avoid', label: 'AVOID' },
]

const PRIORITY_ACTIVE_STYLE: Record<SpotPriority, string> = {
  must: 'border-brass bg-brass text-ink',
  want: 'border-black/25 bg-ink text-text-porcelain',
  avoid: 'border-brick bg-brick text-white',
}

/**
 * Spots & Wishlist（4章 IA）
 * 旅程に入っているもの／まだ入れていないもの（＝行きたいリスト）を並べて見る。
 * MUST/WANT/AVOID は AI の旅程生成・再最適化が優先順位として参照する（12章）。
 */
export function SpotsScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { removeSpot, setSpotPriority } = useTripsStore()
  const [filter, setFilter] = useState<'all' | 'planned' | 'wishlist' | SpotPriority>('all')
  const [adding, setAdding] = useState(false)

  if (!trip || !id) return <Navigate to="/" replace />

  const usedIds = new Set(
    trip.itinerary.flatMap((d) => d.items.map((i) => i.spotId)),
  )

  const spots = trip.spots.filter((s) => {
    if (filter === 'planned') return usedIds.has(s.id)
    if (filter === 'wishlist') return !usedIds.has(s.id)
    if (filter === 'must' || filter === 'want' || filter === 'avoid') return s.priority === filter
    return true
  })

  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-24 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-caps text-text-ink/45">SPOTS &amp; WISHLIST</p>
          <h1 className="font-display text-display-m mt-1">行きたい場所</h1>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          ＋ 追加
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ['all', `すべて ${trip.spots.length}`],
            ['planned', `旅程に入れた ${usedIds.size}`],
            ['wishlist', `まだ ${trip.spots.length - usedIds.size}`],
            ['must', `MUST ${trip.spots.filter((s) => s.priority === 'must').length}`],
            ['want', `WANT ${trip.spots.filter((s) => s.priority === 'want').length}`],
            ['avoid', `AVOID ${trip.spots.filter((s) => s.priority === 'avoid').length}`],
          ] as const
        ).map(([value, label]) => (
          <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spots.map((spot) => (
          <article
            key={spot.id}
            className="anim-rise overflow-hidden rounded-card border border-black/8 bg-white/70"
          >
            <Photo src={spot.photoUrls[0]} alt={spot.name} className="aspect-[4/3] w-full">
              {spot.aiRecommended && (
                <span className="label-caps absolute left-3 top-3 rounded-full bg-brass px-2 py-1 text-ink">
                  AI
                </span>
              )}
              {!usedIds.has(spot.id) && (
                <span className="label-caps absolute right-3 top-3 rounded-full border border-white/30 bg-black/40 px-2 py-1 text-text-porcelain/85">
                  WISHLIST
                </span>
              )}
            </Photo>
            <div className="p-4">
              <h2 className="truncate text-[16px] font-semibold">{spot.name}</h2>
              <p className="mono-readout mt-1 text-[11px] text-text-ink/45">
                {spot.category} · {formatDuration(spot.estimatedStayMin ?? 60)}
                {spot.openingHours ? ` · ${spot.openingHours}` : ''}
              </p>

              <div className="mt-3 flex gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => {
                  const active = spot.priority === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSpotPriority(id, spot.id, active ? undefined : opt.value)}
                      className={`tap label-caps rounded-full border px-2.5 py-1 text-[10px] transition duration-200 ease-passage ${
                        active
                          ? PRIORITY_ACTIVE_STYLE[opt.value]
                          : 'border-black/12 text-text-ink/45 hover:border-black/25'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => removeSpot(id, spot.id)}
                className="tap mt-3 text-[12px] text-text-ink/40 hover:text-brick"
              >
                削除
              </button>
            </div>
          </article>
        ))}
      </div>

      {spots.length === 0 && (
        <p className="mt-10 rounded-card border border-dashed border-black/15 p-8 text-center text-[13px] text-text-ink/45">
          該当するスポットがありません。
        </p>
      )}

      {adding && (
        <AddSpotSheet
          tripId={id}
          dayId={trip.itinerary[0]?.id ?? ''}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
