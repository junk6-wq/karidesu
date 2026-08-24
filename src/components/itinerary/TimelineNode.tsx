import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ItineraryItem, ItineraryWarning, Spot, TravelSegment } from '@/types'
import { Photo } from '@/components/common/Photo'
import { QuestChip } from '@/components/common/QuestChip'
import { formatDuration, toMinutes } from '@/lib/time'
import { formatKm } from '@/lib/format'
import { TRAVEL_MODE_LABEL as MODE_LABEL } from '@/lib/geo'

const TYPE_LABEL: Record<ItineraryItem['type'], string> = {
  sightseeing: '観光',
  meal: '食事',
  stay: '宿泊',
  transit: '移動',
}

const PRIORITY_LABEL: Record<string, string> = { must: 'MUST', want: 'WANT', avoid: 'AVOID' }
const PRIORITY_STYLE: Record<string, string> = {
  must: 'bg-brass/20 text-[#7a5f2b]',
  want: 'bg-black/[0.06] text-text-ink/65',
  avoid: 'bg-brick/10 text-brick',
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
  onMenu,
  nextPlannedArrival,
  onRequestFreeTimeIdea,
}: {
  item: ItineraryItem
  spot?: Spot
  state: NodeState
  warnings: ItineraryWarning[]
  onOpen: () => void
  focused?: boolean
  sortable?: boolean
  /** 「⋮」クイックメニューを開く。省略時はボタンを表示しない。 */
  onMenu?: () => void
  /** 空き時間・遅延余裕の計算に使う、次の予定の到着予定時刻。 */
  nextPlannedArrival?: string
  onRequestFreeTimeIdea?: () => void
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
    <li id={item.id} ref={setNodeRef} style={style} className="relative flex scroll-mt-28 gap-3">
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

      <div className="relative min-w-0 flex-1 pb-2">
        <div
          className={`overflow-hidden rounded-2xl border bg-white/70 transition duration-200 ease-passage ${
            focused ? 'border-brass shadow-card' : 'border-black/8'
          }`}
        >
          <button onClick={onOpen} className="flex w-full items-stretch gap-3 p-2.5 text-left">
            <Photo
              src={spot?.photoUrls[0]}
              alt={spot?.name ?? '予定'}
              className="h-[76px] w-[76px] shrink-0 rounded-xl sm:w-[92px]"
            />
            <span className="min-w-0 flex-1 py-0.5">
              {/* 幅が狭いときは折り返す。バッジ自体は縦に潰れないよう nowrap にする */}
              <span className="mono-readout flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-brass">
                <span className="whitespace-nowrap">
                  {item.plannedArrival ?? '--:--'}
                  {item.plannedDeparture && (
                    <span className="text-text-ink/65"> → {item.plannedDeparture}</span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-black/[0.06] px-1.5 py-0.5 text-text-ink/65">
                  {TYPE_LABEL[item.type]}
                </span>
                {spot?.priority && (
                  <span
                    className={`label-caps shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 ${PRIORITY_STYLE[spot.priority]}`}
                  >
                    {PRIORITY_LABEL[spot.priority]}
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-[16px] font-semibold">
                {spot?.name ?? '不明なスポット'}
              </span>
              {spot?.openingHours && (
                <span className="mono-readout mt-1 block text-[11px] text-text-ink/65">
                  {spot.openingHours}
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-1">
              {onMenu && (
                <span
                  role="button"
                  aria-label="メニューを開く"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu()
                  }}
                  className="tap flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-text-ink/65 hover:bg-black/[0.05]"
                >
                  ⋮
                </span>
              )}
              {/* ドラッグはポインタ操作向け。スマホでは扱いにくいので「⋮」の上へ/下へ移動に任せる */}
              {sortable && (
                <span
                  {...attributes}
                  {...listeners}
                  aria-label="並べ替え"
                  onClick={(e) => e.stopPropagation()}
                  className="tap hidden w-8 shrink-0 cursor-grab touch-none items-center justify-center text-text-ink/65 active:cursor-grabbing sm:flex"
                >
                  ⠿
                </span>
              )}
            </span>
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

        {item.travelToNext && (
          <TravelRow
            segment={item.travelToNext}
            departure={item.plannedDeparture ?? item.plannedArrival}
            nextArrival={nextPlannedArrival}
            onRequestIdea={onRequestFreeTimeIdea}
          />
        )}
      </div>
    </li>
  )
}

/** 車移動時の概算ガソリン代（燃費 14km/L・レギュラー170円/L を仮定した目安値）。 */
function estimateGasCost(distanceKm: number): number {
  return Math.round((distanceKm / 14) * 170)
}

function TravelRow({
  segment,
  departure,
  nextArrival,
  onRequestIdea,
}: {
  segment: TravelSegment
  departure?: string
  nextArrival?: string
  onRequestIdea?: () => void
}) {
  const departureMin = toMinutes(departure)
  const nextArrivalMin = toMinutes(nextArrival)
  const freeMin =
    departureMin !== undefined && nextArrivalMin !== undefined
      ? nextArrivalMin - departureMin - segment.durationMin
      : undefined
  const showFreeTime = freeMin !== undefined && freeMin >= 15

  return (
    <div className="py-1">
      <div className="mono-readout flex flex-wrap items-center gap-x-2 gap-y-1 py-1 pl-1 text-[11px] text-text-ink/65">
        <span>{MODE_LABEL[segment.mode] ?? '移動'}</span>
        <span className="text-brass">{formatDuration(segment.durationMin)}</span>
        {segment.distanceKm !== undefined && <span>{formatKm(segment.distanceKm)}</span>}
        {segment.mode === 'car' && segment.distanceKm !== undefined && (
          <span className="text-text-ink/65">
            ガソリン代 約{estimateGasCost(segment.distanceKm).toLocaleString('ja-JP')}円
            <span className="ml-1 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9px] text-text-ink/65">
              推定
            </span>
          </span>
        )}
      </div>

      {showFreeTime && (
        <div className="mono-readout flex flex-wrap items-center gap-x-2 gap-y-1 py-1 pl-1 text-[11px] text-text-ink/65">
          <span>◇ 自由時間 {formatDuration(freeMin)}</span>
          {onRequestIdea && freeMin >= 60 && (
            <button
              onClick={onRequestIdea}
              className="tap rounded-full border border-black/12 px-2 py-0.5 text-[10px] text-text-ink/65 transition duration-200 ease-passage hover:border-brass"
            >
              AIに候補を出してもらう
            </button>
          )}
        </div>
      )}
    </div>
  )
}
