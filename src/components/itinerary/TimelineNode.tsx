import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ItineraryItem, ItineraryWarning, Spot, TravelSegment } from '@/types'
import { Photo } from '@/components/common/Photo'
import { QuestChip } from '@/components/common/QuestChip'
import { formatDuration } from '@/lib/time'
import { formatKm } from '@/lib/format'

const MODE_LABEL: Record<string, string> = {
  walk: '徒歩',
  car: '車',
  train: '電車',
  bus: 'バス',
  flight: '飛行機',
  other: '移動',
}

const TYPE_LABEL: Record<ItineraryItem['type'], string> = {
  sightseeing: '観光',
  meal: '食事',
  stay: '宿泊',
  transit: '移動',
}

export type NodeState = 'done' | 'next' | 'future'

/**
 * Timeline Node（7章）。訪問済み / 次 / 未来で状態が変わる。
 * ノード間は THE THREAD の点線で繋がる。
 */
export function TimelineNode({
  item,
  spot,
  state,
  warnings,
  onOpen,
  focused,
  sortable = true,
}: {
  item: ItineraryItem
  spot?: Spot
  state: NodeState
  warnings: ItineraryWarning[]
  onOpen: () => void
  focused?: boolean
  sortable?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 20 : undefined,
  } as React.CSSProperties

  const dotClass =
    state === 'done'
      ? 'bg-brass border-brass'
      : state === 'next'
        ? 'bg-brass border-brass ring-[6px] ring-brass/20'
        : 'bg-stone border-black/25'

  return (
    <li ref={setNodeRef} style={style} className="relative flex gap-3">
      {/* THE THREAD の縦線 + ノード */}
      <div className="flex w-6 shrink-0 flex-col items-center pt-5">
        <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${dotClass}`} />
        <span
          className="mt-1 w-px flex-1 text-text-ink"
          style={{
            background:
              state === 'done'
                ? 'var(--c-brass-gold)'
                : 'repeating-linear-gradient(180deg, currentColor 0 3px, transparent 3px 8px)',
            opacity: state === 'done' ? 1 : 0.25,
          }}
        />
      </div>

      <div className="min-w-0 flex-1 pb-2">
        <div
          className={`overflow-hidden rounded-2xl border bg-white/70 transition duration-200 ease-passage ${
            focused ? 'border-brass shadow-card' : 'border-black/8'
          }`}
        >
          <button onClick={onOpen} className="flex w-full items-stretch gap-3 p-2.5 text-left">
            <Photo
              src={spot?.photoUrls[0]}
              alt={spot?.name ?? '予定'}
              className="h-[76px] w-[92px] shrink-0 rounded-xl"
            />
            <span className="min-w-0 flex-1 py-0.5">
              <span className="mono-readout flex items-center gap-2 text-[11px] text-brass">
                {item.plannedArrival ?? '--:--'}
                {item.plannedDeparture && (
                  <span className="text-text-ink/35">→ {item.plannedDeparture}</span>
                )}
                <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-text-ink/50">
                  {TYPE_LABEL[item.type]}
                </span>
              </span>
              <span className="mt-1 block truncate text-[16px] font-semibold">
                {spot?.name ?? '不明なスポット'}
              </span>
              {spot?.openingHours && (
                <span className="mono-readout mt-1 block text-[11px] text-text-ink/40">
                  {spot.openingHours}
                </span>
              )}
            </span>

            {sortable && (
              <span
                {...attributes}
                {...listeners}
                aria-label="並べ替え"
                onClick={(e) => e.stopPropagation()}
                className="tap flex w-8 shrink-0 cursor-grab touch-none items-center justify-center text-text-ink/25 active:cursor-grabbing"
              >
                ⠿
              </span>
            )}
          </button>

          {warnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-black/6 px-3 py-2">
              {warnings.map((w, i) => (
                <QuestChip key={i} severity={w.severity}>
                  {w.message}
                </QuestChip>
              ))}
            </div>
          )}
        </div>

        {item.travelToNext && <TravelRow segment={item.travelToNext} />}
      </div>
    </li>
  )
}

function TravelRow({ segment }: { segment: TravelSegment }) {
  return (
    <div className="mono-readout flex items-center gap-2 py-2 pl-1 text-[11px] text-text-ink/45">
      <span>{MODE_LABEL[segment.mode] ?? '移動'}</span>
      <span className="text-brass">{formatDuration(segment.durationMin)}</span>
      {segment.distanceKm !== undefined && <span>{formatKm(segment.distanceKm)}</span>}
    </div>
  )
}
