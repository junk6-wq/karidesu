import type {
  AIAgentProvider,
  AIProposal,
  DayLoad,
  GeoPoint,
  ItineraryDay,
  ItineraryWarning,
  JourneyState,
  MemoryEntry,
  ReplanSuggestion,
  Spot,
  Trip,
  TripContext,
  TripHealth,
} from '@/types'
import { uid } from '@/lib/id'
import { estimateDurationMin, haversineKm } from '@/lib/geo'
import { addMinutes, formatDuration, toMinutes, weekdayJa } from '@/lib/time'
import { spotSeeds } from './spotSeeds'
import { proposeItineraryChanges as buildProposals } from '@/lib/aiProposals'
import { evaluateDayLoadSync, evaluateTripHealthSync } from '@/lib/tripHealth'
import { formatCurrency } from '@/lib/format'

/** 実 API 導入までの遅延演出。UX の「考えている間」を再現する。 */
const think = (ms = 620) => new Promise<void>((r) => setTimeout(r, ms))

/** ペースごとの「快適な」1日あたりのスポット数。取捨選択画面の詰め込み判定にも使う。 */
export const PACE_CAPACITY: Record<TripContext['pace'], number> = {
  relaxed: 2,
  balanced: 3,
  packed: 4,
}

function pickSeeds(destination: string, interests: string[], count: number): Spot[] {
  const key = Object.keys(spotSeeds).find((k) => destination.includes(k))
  const pool = key ? spotSeeds[key] : Object.values(spotSeeds).flat()

  const scored = pool.map((seed) => {
    const hit = interests.filter((i) => seed.tags.includes(i)).length
    return { seed, score: hit }
  })
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, count).map(({ seed }) => ({
    id: uid('spot'),
    name: seed.name,
    category: seed.category,
    location: seed.location,
    photoUrls: seed.photoUrls,
    openingHours: seed.openingHours,
    closedDays: seed.closedDays,
    estimatedStayMin: seed.estimatedStayMin,
    priceLevel: seed.priceLevel,
    aiRecommended: true,
    source: 'ai' as const,
  }))
}

/** 定休日メモ（"月" など）と実際の曜日が衝突していないか見る。 */
function closedOnDate(spot: Spot | undefined, dateISO: string): boolean {
  if (!spot?.closedDays?.length) return false
  const wd = weekdayJa(dateISO)
  return spot.closedDays.some((d) => d.includes(wd))
}

/**
 * モック AI エージェント。
 * 固定ロジックだが「移動時間・営業時間・詰め込みすぎ」という
 * 実運用で本当に効く 3 種類の検証を行い、UX パターンを検証できるようにする。
 */
export class MockAIAgentProvider implements AIAgentProvider {
  async suggestSpots(context: TripContext, opts?: { overshoot?: boolean }): Promise<Spot[]> {
    await think()
    const perDay = PACE_CAPACITY[context.pace]
    const days = Math.max(
      1,
      Math.round(
        (new Date(context.endDate).getTime() - new Date(context.startDate).getTime()) /
          86_400_000,
      ) + 1,
    )
    // overshoot: ペースどおりに収まる件数より多めに出し、あとで取捨選択できるようにする
    const count = opts?.overshoot
      ? Math.min(16, Math.ceil(perDay * 1.6) * days)
      : Math.min(12, perDay * days)
    return pickSeeds(context.destination, context.interests, count)
  }

  async optimizeItinerary(trip: Trip) {
    await think(420)
    const spotById = new Map(trip.spots.map((s) => [s.id, s]))
    const warnings: ItineraryWarning[] = []

    const days: ItineraryDay[] = trip.itinerary.map((day) => {
      const items = day.items.map((item, index) => {
        const spot = spotById.get(item.spotId)
        const next = day.items[index + 1]
        const nextSpot = next ? spotById.get(next.spotId) : undefined

        // 1) 移動区間の再計算（THE THREAD の描画もこの値を使う）
        let travelToNext = item.travelToNext
        if (spot && nextSpot) {
          const distanceKm = haversineKm(spot.location, nextSpot.location)
          const mode = travelToNext?.mode ?? (distanceKm > 3 ? 'car' : 'walk')
          travelToNext = {
            mode,
            distanceKm: Number(distanceKm.toFixed(1)),
            durationMin: estimateDurationMin(distanceKm, mode),
            route: [spot.location, nextSpot.location],
          }
        } else if (!next) {
          travelToNext = undefined
        }

        // 2a) AVOID に設定されたスポットが旅程に残っていないか
        if (spot?.priority === 'avoid') {
          warnings.push({
            itemId: item.id,
            severity: 'warn',
            message: `${spot.name} は AVOID（避けたい場所）に設定されています`,
          })
        }

        // 2b) 定休日チェック
        if (closedOnDate(spot, day.date)) {
          warnings.push({
            itemId: item.id,
            severity: 'risk',
            message: `${spot?.name} はこの日が定休日の可能性があります`,
            category: 'opening_hours',
          })
        }

        // 3) 到着予定と実移動時間の突き合わせ、および余裕（rest_margin）チェック
        const departure = item.plannedDeparture ?? item.plannedArrival
        const nextArrival = next?.plannedArrival
        if (departure && nextArrival && travelToNext) {
          const gap = (toMinutes(nextArrival) ?? 0) - (toMinutes(departure) ?? 0)
          const slack = gap - travelToNext.durationMin
          if (slack < 0) {
            warnings.push({
              itemId: item.id,
              severity: 'warn',
              message: `次の予定まで ${formatDuration(gap)} ですが移動に ${formatDuration(
                travelToNext.durationMin,
              )} かかります`,
              category: 'travel_time',
            })
          } else if (slack < 15) {
            warnings.push({
              itemId: item.id,
              severity: 'info',
              message: `${nextSpot?.name ?? '次の予定'} まで余裕が ${formatDuration(slack)} しかありません`,
              category: 'rest_margin',
            })
          }
        }

        return { ...item, travelToNext }
      })

      // 4) 1 日の詰め込みすぎ
      if (items.length >= 6) {
        warnings.push({
          itemId: items[items.length - 1].id,
          severity: 'info',
          message: 'この日は予定が 6 件以上です。1 つ翌日に回すと余裕が出ます',
          category: 'density',
        })
      }

      return { ...day, items }
    })

    // 5) 予算超過チェック（実績が計画を上回っている場合のみ）
    const plannedTotal = Object.values(trip.budget.planned).reduce((a, b) => a + b, 0)
    const actualTotal = Object.values(trip.budget.actual ?? {}).reduce((a, b) => a + b, 0)
    const lastItem = [...days].reverse().find((d) => d.items.length > 0)?.items.slice(-1)[0]
    if (actualTotal > plannedTotal && plannedTotal > 0 && lastItem) {
      warnings.push({
        itemId: lastItem.id,
        severity: actualTotal > plannedTotal * 1.15 ? 'risk' : 'warn',
        message: `実績が計画予算を ${formatCurrency(actualTotal - plannedTotal, trip.budget.currency)} 上回っています`,
        category: 'budget',
      })
    }

    return { days, warnings }
  }

  async detectDelay(journey: JourneyState, trip: Trip): Promise<ReplanSuggestion[]> {
    await think(380)
    const delay = Math.max(1, Math.round(journey.delayMinutes))
    const day = trip.itinerary.find((d) => d.items.some((i) => i.id === journey.nextItemId))
    const items = day?.items ?? []
    const index = items.findIndex((i) => i.id === journey.nextItemId)
    const current = items[index]
    const next = items[index + 1]
    const spotName = (itemId?: string) => {
      const item = items.find((i) => i.id === itemId)
      return trip.spots.find((s) => s.id === item?.spotId)?.name ?? 'この予定'
    }

    const suggestions: ReplanSuggestion[] = []

    // 滞在を削れるのは「実際にそこにいる予定の時間」まで。
    // 遅れが滞在時間より大きいときは、削るのではなく落とす案に切り替える。
    const currentStay =
      (toMinutes(current?.plannedDeparture) ?? 0) - (toMinutes(current?.plannedArrival) ?? 0)
    const trimmable = Math.max(0, Math.min(delay, currentStay - 15))

    if (current && trimmable >= 5) {
      suggestions.push({
        id: uid('rp'),
        title: `${spotName(current.id)} の滞在を ${trimmable} 分短くする`,
        detail: '以降の予定はそのまま。いちばん影響の小さい調整です。',
        savedMinutes: trimmable,
        action: { kind: 'shorten', itemId: current.id, minutes: trimmable },
      })
    } else if (current) {
      suggestions.push({
        id: uid('rp'),
        title: `${spotName(current.id)} を今回は見送る`,
        detail: '削るぶん、このあとの予定に余裕が戻ります。',
        savedMinutes: Math.max(currentStay, delay),
        action: { kind: 'drop', itemId: current.id },
      })
    }

    if (current && next) {
      suggestions.push({
        id: uid('rp'),
        title: `${spotName(next.id)} を先に回る`,
        detail: '順番を入れ替えると、混雑と移動のロスをまとめて避けられます。',
        savedMinutes: Math.round(delay * 0.7),
        action: { kind: 'swap', itemIdA: current.id, itemIdB: next.id },
      })
    }

    suggestions.push({
      id: uid('rp'),
      title: `この先の予定をまとめて ${delay} 分ずらす`,
      detail: '予定は削らず、今日の終わりを後ろに倒します。',
      savedMinutes: 0,
      action: { kind: 'shift', minutes: delay },
    })

    return suggestions.slice(0, 3)
  }

  async generateTravelogue(trip: Trip): Promise<MemoryEntry> {
    await think(900)
    const spotById = new Map(trip.spots.map((s) => [s.id, s]))

    let totalDistanceKm = 0
    let visitedSpotCount = 0
    const route: number[][] = []
    const chapters: string[] = []

    let previous: GeoPoint | undefined

    trip.itinerary.forEach((day, dayIndex) => {
      const names: string[] = []
      day.items.forEach((item) => {
        const spot = spotById.get(item.spotId)
        if (!spot) return
        names.push(spot.name)
        visitedSpotCount += 1
        route.push([spot.location.lng, spot.location.lat])
        // 検証済みの区間があればその距離を、無ければ座標から直接測る
        // （MEMORY は旅程を一度も開かずに生成されうるため）
        if (item.travelToNext?.distanceKm) {
          totalDistanceKm += item.travelToNext.distanceKm
        } else if (previous) {
          totalDistanceKm += haversineKm(previous, spot.location)
        }
        previous = spot.location
      })
      if (names.length === 0) return

      const head = names[0]
      const tail = names[names.length - 1]
      const middle = names.slice(1, -1)
      const body =
        names.length === 1
          ? `この日は ${head} だけに時間を使った。急がないと決めた日だった。`
          : `${head} からはじまり、${
              middle.length ? `${middle.join('、')}を経て、` : ''
            }${tail} で日が暮れた。`

      chapters.push(`${dayIndex + 1}日目 — ${body}`)
    })

    const actual = trip.budget.actual ?? trip.budget.planned
    const totalCost = Object.values(actual).reduce((a, b) => a + b, 0)

    const opening = `${trip.destination}へ。${trip.itinerary.length}日間の旅がはじまった。`
    const closing = `全部で ${Math.round(totalDistanceKm)} km。${visitedSpotCount} か所を巡って、旅は終わった。予定どおりに進んだ日もあれば、そうでない日もあった。どちらもこの旅の一部だった。`

    return {
      id: uid('mem'),
      tripId: trip.id,
      narrative: [opening, ...chapters, closing].join('\n\n'),
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      totalCost,
      visitedSpotCount,
      routeGeoJson: {
        type: 'Feature',
        properties: { name: trip.title },
        geometry: { type: 'LineString', coordinates: route },
      },
      heroPhotoUrl: trip.coverPhotoUrl ?? spotById.get(trip.spots[0]?.id)?.photoUrls[0],
      generatedAt: new Date().toISOString(),
    }
  }

  async proposeItineraryChanges(trip: Trip, request: string): Promise<AIProposal[]> {
    await think(520)
    return buildProposals(trip, request)
  }

  async evaluateTripHealth(trip: Trip, warnings: ItineraryWarning[]): Promise<TripHealth> {
    await think(200)
    return evaluateTripHealthSync(trip, warnings)
  }

  async evaluateDayLoad(trip: Trip): Promise<DayLoad[]> {
    await think(150)
    return evaluateDayLoadSync(trip)
  }
}

/** 差し替えポイント。将来ここを ClaudeAgentProvider 等に変える。 */
export const aiAgent: AIAgentProvider = new MockAIAgentProvider()

/** 旅程を丸ごと組み立てる（S02 のヒアリング結果から初期案を作る）。 */
export function buildDraftItinerary(spots: Spot[], dates: string[]): ItineraryDay[] {
  // どの日も空にならないよう均等に配る（余りは前の日から 1 件ずつ）
  const base = Math.floor(spots.length / Math.max(1, dates.length))
  const extra = spots.length % Math.max(1, dates.length)
  let cursor = 0

  return dates.map((date, dayIndex) => {
    const size = base + (dayIndex < extra ? 1 : 0)
    const slice = spots.slice(cursor, cursor + size)
    cursor += size
    let clock = '09:30'
    return {
      id: uid('day'),
      date,
      items: slice.map((spot) => {
        const stay = spot.estimatedStayMin ?? 60
        const arrival = clock
        const departure = addMinutes(arrival, stay)
        clock = addMinutes(departure, 40)
        return {
          id: uid('item'),
          spotId: spot.id,
          type: spot.category === '食事' ? ('meal' as const) : ('sightseeing' as const),
          plannedArrival: arrival,
          plannedDeparture: departure,
        }
      }),
    }
  })
}
