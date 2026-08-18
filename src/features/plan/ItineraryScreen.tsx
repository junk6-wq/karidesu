import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ItineraryItem } from '@/types'
import { useTrip, useTripWarnings, useTripsStore } from '@/store/tripsStore'
import { TimelineNode, type NodeState } from '@/components/itinerary/TimelineNode'
import { MapLayer } from '@/components/map/MapLayer'
import { Button } from '@/components/common/Button'
import { SpotDetailSheet } from './SpotDetailSheet'
import { AddSpotSheet } from './AddSpotSheet'
import { formatDateDot, toISODate, weekdayEn } from '@/lib/time'
import { tripProgress } from '@/lib/tripStats'

/**
 * S04 — Itinerary Timeline
 * 左に垂直タイムライン、右にミニマップ。並べ替えのたびに
 * AI が移動時間・営業時間を検証し、該当ノードに QuestChip を出す。
 */
export function ItineraryScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const warnings = useTripWarnings(id)
  const { reorderItems, runOptimize, agentBusy } = useTripsStore()

  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [addToDayId, setAddToDayId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | undefined>()
  const [mobileTab, setMobileTab] = useState<'timeline' | 'map'>('timeline')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 画面を開いた時点で一度検証する（並べ替え時にも再実行）
  useEffect(() => {
    if (id) void runOptimize(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const warningsByItem = useMemo(() => {
    const map = new Map<string, typeof warnings>()
    warnings.forEach((w) => {
      map.set(w.itemId, [...(map.get(w.itemId) ?? []), w])
    })
    return map
  }, [warnings])

  if (!trip) return <Navigate to="/" replace />

  const todayISO = toISODate(new Date())
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))

  function stateOf(item: ItineraryItem, dayDate: string): NodeState {
    if (item.actualArrival) return 'done'
    if (dayDate < todayISO) return 'done'
    if (dayDate === todayISO) {
      const day = trip!.itinerary.find((d) => d.date === dayDate)
      const firstPending = day?.items.find((i) => !i.actualArrival)
      return firstPending?.id === item.id ? 'next' : 'future'
    }
    return 'future'
  }

  async function onDragEnd(event: DragEndEvent, dayId: string) {
    const { active, over } = event
    if (!over || active.id === over.id || !id) return
    const day = trip!.itinerary.find((d) => d.id === dayId)
    if (!day) return
    const ids = day.items.map((i) => i.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    reorderItems(id, dayId, next)
    // 並べ替え後は移動時間と警告を組み直す
    await runOptimize(id)
  }

  const markers = trip.itinerary.flatMap((day) =>
    day.items.flatMap((item) => {
      const spot = spotById.get(item.spotId)
      if (!spot) return []
      return [
        {
          id: item.id,
          position: spot.location,
          label: spot.name,
          state: stateOf(item, day.date),
        },
      ]
    }),
  )

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-caps text-text-ink/45">DAY BY DAY</p>
          <h1 className="font-display text-display-m mt-1">旅程</h1>
        </div>
        <Button onClick={() => id && runOptimize(id)} disabled={agentBusy}>
          {agentBusy ? '検証中…' : 'AI に検証させる'}
        </Button>
      </div>

      {/* モバイルはタブ切替、デスクトップは 2 カラム */}
      <div className="mt-5 flex gap-1 rounded-full border border-black/10 p-1 lg:hidden">
        {(['timeline', 'map'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`tap flex-1 rounded-full text-[12px] tracking-[0.14em] ${
              mobileTab === tab ? 'bg-ink text-text-porcelain' : 'text-text-ink/50'
            }`}
            style={{ fontFamily: 'var(--f-mono)' }}
          >
            {tab === 'timeline' ? 'TIMELINE' : 'MAP'}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <div className={mobileTab === 'map' ? 'hidden lg:block' : ''}>
          {trip.itinerary.map((day, dayIndex) => (
            <section key={day.id} id={day.id} className="mb-9 scroll-mt-28">
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="mono-readout text-[13px] text-brass">
                  DAY {String(dayIndex + 1).padStart(2, '0')}
                </h2>
                <span className="mono-readout text-[11px] text-text-ink/40">
                  {formatDateDot(day.date)} {weekdayEn(day.date)}
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => onDragEnd(e, day.id)}
              >
                <SortableContext
                  items={day.items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="list-none">
                    {day.items.map((item) => (
                      <TimelineNode
                        key={item.id}
                        item={item}
                        spot={spotById.get(item.spotId)}
                        state={stateOf(item, day.date)}
                        warnings={warningsByItem.get(item.id) ?? []}
                        focused={focusId === item.id}
                        onOpen={() => {
                          setFocusId(item.id)
                          setOpenItemId(item.id)
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {day.items.length === 0 && (
                <p className="rounded-2xl border border-dashed border-black/15 p-5 text-[13px] text-text-ink/45">
                  この日はまだ空です。
                </p>
              )}

              <button
                onClick={() => setAddToDayId(day.id)}
                className="tap mt-2 flex w-full items-center justify-center rounded-2xl border border-dashed border-black/15 text-[13px] text-text-ink/50 transition duration-200 ease-passage hover:border-brass hover:text-text-ink"
              >
                ＋ この日に追加
              </button>
            </section>
          ))}
        </div>

        <div className={`${mobileTab === 'timeline' ? 'hidden lg:block' : ''} lg:sticky lg:top-28 lg:self-start`}>
          <div className="overflow-hidden rounded-card border border-black/10">
            <MapLayer
              markers={markers}
              progress={tripProgress(trip)}
              focusId={focusId}
              onSelect={(itemId) => {
                setFocusId(itemId)
                setOpenItemId(itemId)
              }}
              className="h-[380px] w-full lg:h-[calc(100dvh-220px)]"
            />
          </div>
        </div>
      </div>

      {openItemId && (
        <SpotDetailSheet
          tripId={trip.id}
          itemId={openItemId}
          onClose={() => setOpenItemId(null)}
        />
      )}
      {addToDayId && (
        <AddSpotSheet tripId={trip.id} dayId={addToDayId} onClose={() => setAddToDayId(null)} />
      )}
    </div>
  )
}
