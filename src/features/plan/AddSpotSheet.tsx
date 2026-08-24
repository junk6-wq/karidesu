import { useEffect, useState } from 'react'
import type { Spot } from '@/types'
import { BottomSheet } from '@/components/common/Sheet'
import { Button } from '@/components/common/Button'
import { Photo } from '@/components/common/Photo'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { mapProvider } from '@/lib/providers/localMap'
import { centroid } from '@/lib/geo'
import { addMinutes } from '@/lib/time'

/**
 * 旅程への追加。
 * 1) すでにこの旅に登録済みのスポットから選ぶ
 * 2) 検索する（MVP は種データ、将来 Places API）
 * 3) 手で登録する
 */
export function AddSpotSheet({
  tripId,
  dayId,
  onClose,
}: {
  tripId: string
  dayId: string
  onClose: () => void
}) {
  const trip = useTrip(tripId)
  const { addSpot, addItem, runOptimize } = useTripsStore()
  const [tab, setTab] = useState<'existing' | 'search' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Spot[]>([])
  const [manual, setManual] = useState({ name: '', category: '観光', stay: 60, hours: '' })

  const day = trip?.itinerary.find((d) => d.id === dayId)

  useEffect(() => {
    let alive = true
    if (!query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const near = trip ? centroid(trip.spots.map((s) => s.location)) : undefined
      const found = await mapProvider.searchPlaces(query, near)
      if (alive) setResults(found)
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, trip])

  if (!trip || !day) return null

  /** その日の最後の予定の次の時間帯に差し込む。 */
  function nextSlot(): { arrival: string; departure: string } {
    const last = day!.items[day!.items.length - 1]
    const base = last?.plannedDeparture ?? last?.plannedArrival ?? '09:00'
    const arrival = last ? addMinutes(base, 45) : base
    return { arrival, departure: addMinutes(arrival, 60) }
  }

  function push(spotId: string, category: string, stayMin: number) {
    const { arrival } = nextSlot()
    addItem(tripId, dayId, {
      spotId,
      type: category === '食事' ? 'meal' : category === '温泉' ? 'stay' : 'sightseeing',
      plannedArrival: arrival,
      plannedDeparture: addMinutes(arrival, stayMin),
    })
    void runOptimize(tripId)
    onClose()
  }

  function addFound(found: Spot) {
    const existing = trip!.spots.find((s) => s.name === found.name)
    const spot = existing ?? addSpot(tripId, { ...found, source: 'user' })
    push(spot.id, spot.category, spot.estimatedStayMin ?? 60)
  }

  function addManual() {
    const name = manual.name.trim()
    if (!name) return
    const spot = addSpot(tripId, {
      name,
      category: manual.category,
      // 座標が分からないものは既存スポットの重心に置く（地図上で破綻させないため）
      location: centroid(trip!.spots.map((s) => s.location)),
      photoUrls: [],
      openingHours: manual.hours || undefined,
      estimatedStayMin: manual.stay,
      source: 'user',
    })
    push(spot.id, manual.category, manual.stay)
  }

  const unused = trip.spots.filter(
    (s) => !trip.itinerary.some((d) => d.items.some((i) => i.spotId === s.id)),
  )

  return (
    <BottomSheet open onClose={onClose} title="予定を追加">
      <div className="flex gap-1 rounded-full border border-black/10 p-1">
        {(
          [
            ['search', '検索'],
            ['existing', `登録済み (${unused.length})`],
            ['manual', '手で登録'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`tap flex-1 rounded-full text-[12px] ${
              tab === value ? 'bg-ink text-text-porcelain' : 'text-text-ink/55'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="mt-5">
          {/* autoFocus は外した。スマートフォンでシートが開いた瞬間にキーボードが
              せり上がり、下に並ぶ検索結果が隠れて何も選べない状態になっていた。
              Sheet 側が開いたときに先頭要素へフォーカスを移すので、
              キーボード操作でも自力で辿り着ける。 */}
          <input
            type="search"
            aria-label="スポットを検索"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="場所やカテゴリで検索"
            className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 placeholder:text-text-ink/30 focus:border-brass"
          />
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.id}>
                <SpotRow spot={r} onClick={() => addFound(r)} />
              </li>
            ))}
            {query && results.length === 0 && (
              <p className="py-6 text-center text-[13px] text-text-ink/45">
                見つかりませんでした。「手で登録」から追加できます。
              </p>
            )}
          </ul>
        </div>
      )}

      {tab === 'existing' && (
        <ul className="mt-5 space-y-2">
          {unused.map((s) => (
            <li key={s.id}>
              <SpotRow
                spot={s}
                onClick={() => push(s.id, s.category, s.estimatedStayMin ?? 60)}
              />
            </li>
          ))}
          {unused.length === 0 && (
            <p className="py-6 text-center text-[13px] text-text-ink/45">
              登録済みのスポットはすべて旅程に入っています。
            </p>
          )}
        </ul>
      )}

      {tab === 'manual' && (
        <div className="mt-5 space-y-4">
          <Field label="名前">
            <input
              autoComplete="off"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
              placeholder="例: 祖母の家"
              className="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-brass"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="カテゴリ">
              <input
                value={manual.category}
                onChange={(e) => setManual({ ...manual, category: e.target.value })}
                className="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-brass"
              />
            </Field>
            <Field label="滞在（分）">
              <input
                type="number"
                inputMode="numeric"
                value={manual.stay}
                onChange={(e) => setManual({ ...manual, stay: Number(e.target.value) || 0 })}
                className="mono-readout w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-brass"
              />
            </Field>
          </div>
          <Field label="営業時間メモ">
            <input
              value={manual.hours}
              onChange={(e) => setManual({ ...manual, hours: e.target.value })}
              placeholder="09:00–17:00"
              className="w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 placeholder:text-text-ink/30 focus:border-brass"
            />
          </Field>
          <Button variant="primary" className="w-full" onClick={addManual}>
            追加する
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}

function SpotRow({ spot, onClick }: { spot: Spot; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white p-2 text-left transition duration-200 ease-passage hover:border-brass"
    >
      <Photo src={spot.photoUrls[0]} alt={spot.name} className="h-12 w-16 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{spot.name}</span>
        <span className="mono-readout mt-0.5 block text-[11px] text-text-ink/45">
          {spot.category}
        </span>
      </span>
      <span className="mono-readout text-brass">＋</span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps text-text-ink/45">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  )
}
