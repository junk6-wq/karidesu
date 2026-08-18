import type {
  AIProposal,
  AIProposalChange,
  BudgetCategory,
  ItineraryDay,
  ItineraryItem,
  Spot,
  Trip,
} from '@/types'
import { uid } from '@/lib/id'
import { centroid, haversineKm } from '@/lib/geo'
import { addMinutes, formatDuration, toMinutes } from '@/lib/time'
import { spotSeeds } from '@/lib/providers/spotSeeds'
import { evaluateDayLoadSync } from '@/lib/tripHealth'

/**
 * AI 自然言語編集のルールベース実装（30章 mockAgent 改善）。
 * 実 AI に差し替わっても呼び出し側のインターフェースが変わらないよう、
 * 「文章を解釈 → 構造化された AIProposalChange[] を組み立てる」という
 * 実 AI と同じ形で結果を返す。ここでは固定ロジックでそれを模倣している。
 */

/** 変更を旅程に適用したプレビューを作る（適用ボタンでも同じ関数を使う＝差分表示と実適用のロジックを一本化）。 */
export function applyChangesToItinerary(
  itinerary: ItineraryDay[],
  changes: AIProposalChange[],
): ItineraryDay[] {
  let next = itinerary.map((d) => ({ ...d, items: [...d.items] }))

  for (const change of changes) {
    switch (change.kind) {
      case 'move_item': {
        let moving: ItineraryItem | undefined
        next = next.map((d) => {
          const found = d.items.find((i) => i.id === change.itemId)
          if (found) moving = found
          return { ...d, items: d.items.filter((i) => i.id !== change.itemId) }
        })
        if (moving) {
          next = next.map((d) => (d.id === change.toDayId ? { ...d, items: [...d.items, moving as ItineraryItem] } : d))
        }
        break
      }
      case 'update_time': {
        next = next.map((d) => ({
          ...d,
          items: d.items.map((i) =>
            i.id === change.itemId
              ? {
                  ...i,
                  plannedArrival: change.plannedArrival ?? i.plannedArrival,
                  plannedDeparture: change.plannedDeparture ?? i.plannedDeparture,
                }
              : i,
          ),
        }))
        break
      }
      case 'reorder_day': {
        next = next.map((d) => {
          if (d.id !== change.dayId) return d
          const byId = new Map(d.items.map((i) => [i.id, i]))
          const ordered = change.orderedItemIds
            .map((id) => byId.get(id))
            .filter((i): i is ItineraryItem => Boolean(i))
          const rest = d.items.filter((i) => !change.orderedItemIds.includes(i.id))
          return { ...d, items: [...ordered, ...rest] }
        })
        break
      }
      case 'add_spot': {
        const item: ItineraryItem = {
          id: uid('item'),
          spotId: change.spot.id,
          type: change.spot.category === '食事' ? 'meal' : 'sightseeing',
          plannedArrival: change.plannedArrival,
          plannedDeparture: change.plannedArrival
            ? addMinutes(change.plannedArrival, change.spot.estimatedStayMin ?? 60)
            : undefined,
        }
        next = next.map((d) => (d.id === change.dayId ? { ...d, items: [...d.items, item] } : d))
        break
      }
      case 'remove_item': {
        next = next.map((d) => ({ ...d, items: d.items.filter((i) => i.id !== change.itemId) }))
        break
      }
      case 'adjust_budget':
        // 予算はプレビュー側の previewBudgetPlanned で扱うため、旅程には影響しない
        break
    }
  }

  return next
}

interface RuleContext {
  trip: Trip
  spotById: Map<string, Spot>
}

function dayIndexFromText(text: string): number | undefined {
  const m = /(\d+)\s*日目|DAY\s*(\d+)/i.exec(text)
  const n = m ? Number(m[1] ?? m[2]) : undefined
  return n && n >= 1 ? n - 1 : undefined
}

function totalDistanceKm(day: ItineraryDay): number {
  return day.items.reduce((sum, i) => sum + (i.travelToNext?.distanceKm ?? 0), 0)
}

function makeProposal(partial: Omit<AIProposal, 'id' | 'previewItinerary'> & { trip: Trip }): AIProposal {
  const { trip, ...rest } = partial
  return {
    id: uid('prop'),
    previewItinerary: applyChangesToItinerary(trip.itinerary, rest.changes),
    ...rest,
  }
}

/** 「N日目をゆっくりにして」: 予定が多い日から末尾のスポットを翌日へ逃がす。 */
function ruleSlowDown(ctx: RuleContext, text: string): AIProposal | undefined {
  if (!/ゆっくり|ゆったり|のんびり/.test(text)) return undefined
  const dayIdx = dayIndexFromText(text)
  const { trip } = ctx
  const day = dayIdx !== undefined ? trip.itinerary[dayIdx] : [...trip.itinerary].sort((a, b) => b.items.length - a.items.length)[0]
  if (!day || day.items.length < 2) return undefined

  const dayNumber = trip.itinerary.indexOf(day) + 1
  const nextDay = trip.itinerary[trip.itinerary.indexOf(day) + 1]
  // MUST に設定された予定は動かさない。末尾から最初の非 MUST を探す
  const moving = [...day.items].reverse().find((i) => ctx.spotById.get(i.spotId)?.priority !== 'must')
  if (!moving) return undefined
  const spot = ctx.spotById.get(moving.spotId)

  if (!nextDay) {
    // 翌日がない最終日は、最後の予定を削って余白を作る
    const change: AIProposalChange = {
      kind: 'remove_item',
      itemId: moving.id,
      label: `${spot?.name ?? 'この予定'} を今回は外す`,
    }
    return makeProposal({
      trip,
      summary: `DAY${dayNumber} の予定を1件減らして、ゆとりを作ります`,
      reason: `DAY${dayNumber} は現在 ${day.items.length} 件の予定があります。最終日のため翌日に回せないので、最後の ${spot?.name ?? '予定'} を削る案です。`,
      benefits: ['1日の余裕が生まれる', '移動の慌ただしさが減る'],
      drawbacks: [`${spot?.name ?? 'この場所'} には行けなくなる`],
      changes: [change],
      estimatedTimeDeltaMin: -(spot?.estimatedStayMin ?? 60),
      confidence: 0.62,
    })
  }

  const change: AIProposalChange = {
    kind: 'move_item',
    itemId: moving.id,
    toDayId: nextDay.id,
    label: `${spot?.name ?? 'この予定'} を DAY${dayNumber + 1} へ移動`,
  }
  return makeProposal({
    trip,
    summary: `DAY${dayNumber} の最後の予定を DAY${dayNumber + 1} に移して、ゆとりを作ります`,
    reason: `DAY${dayNumber} は現在 ${day.items.length} 件の予定があります。最後に入れた ${spot?.name ?? '予定'} を翌日に回すと、1日あたりの密度が下がります。`,
    benefits: ['DAY' + dayNumber + 'の移動と滞在に余裕ができる', '慌ただしさが減る'],
    drawbacks: [`DAY${dayNumber + 1} の予定が1件増える`],
    changes: [change],
    confidence: 0.7,
  })
}

/** 「移動距離を減らして」: 移動距離が最大の日を、最近傍法で組み直す。 */
function ruleReduceDistance(ctx: RuleContext, text: string): AIProposal | undefined {
  if (!/移動距離|移動を減らし|移動を短く/.test(text)) return undefined
  const { trip, spotById } = ctx
  const target = [...trip.itinerary]
    .filter((d) => d.items.length >= 3)
    .sort((a, b) => totalDistanceKm(b) - totalDistanceKm(a))[0]
  if (!target) return undefined

  const items = [...target.items]
  const remaining = [...items]
  const ordered: ItineraryItem[] = [remaining.shift() as ItineraryItem]
  while (remaining.length) {
    const last = spotById.get(ordered[ordered.length - 1].spotId)
    if (!last) {
      ordered.push(remaining.shift() as ItineraryItem)
      continue
    }
    remaining.sort((a, b) => {
      const sa = spotById.get(a.spotId)
      const sb = spotById.get(b.spotId)
      const da = sa ? haversineKm(last.location, sa.location) : Infinity
      const db = sb ? haversineKm(last.location, sb.location) : Infinity
      return da - db
    })
    ordered.push(remaining.shift() as ItineraryItem)
  }

  const orderedIds = ordered.map((i) => i.id)
  const changed = orderedIds.some((id, i) => id !== items[i].id)
  if (!changed) return undefined

  const before = totalDistanceKm(target)
  let after = 0
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const a = spotById.get(ordered[i].spotId)
    const b = spotById.get(ordered[i + 1].spotId)
    if (a && b) after += haversineKm(a.location, b.location)
  }
  if (after >= before) return undefined

  const dayNumber = trip.itinerary.indexOf(target) + 1
  return makeProposal({
    trip,
    summary: `DAY${dayNumber} の順番を移動距離が少なくなるよう並べ替えます`,
    reason: `DAY${dayNumber} は現在の順番だと移動距離が約 ${before.toFixed(1)} km あります。近い場所同士をまとめると約 ${after.toFixed(1)} km に減らせます。`,
    benefits: ['総移動距離が減る', '車での移動負担が減る'],
    drawbacks: ['訪問順が変わるため、時間帯によっては混雑状況が変わる可能性がある'],
    changes: [{ kind: 'reorder_day', dayId: target.id, orderedItemIds: orderedIds, label: `DAY${dayNumber} を並べ替え` }],
    estimatedDistanceDeltaKm: Number((after - before).toFixed(1)),
    confidence: 0.68,
  })
}

/** 「温泉を追加して」など、カテゴリ名を含む追加リクエスト。 */
function ruleAddCategory(ctx: RuleContext, text: string): AIProposal | undefined {
  const categories = ['温泉', 'グルメ', '食事', '絶景', '歴史', 'アート', '街歩き', '自然', '海']
  const found = categories.find((c) => text.includes(c) && /追加|入れ|足し|欲し/.test(text))
  if (!found) return undefined
  const category = found === 'グルメ' ? '食事' : found

  const { trip } = ctx
  const usedNames = new Set(trip.spots.map((s) => s.name))
  const pool = Object.values(spotSeeds)
    .flat()
    .filter((s) => s.category === category && !usedNames.has(s.name))
  if (pool.length === 0) return undefined

  const base = centroid(trip.spots.map((s) => s.location))
  const seed = [...pool].sort((a, b) => haversineKm(base, a.location) - haversineKm(base, b.location))[0]

  const dayLoads = evaluateDayLoadSync(trip)
  const lightestDayId = [...dayLoads].sort((a, b) => a.score - b.score)[0]?.dayId
  const targetDay = trip.itinerary.find((d) => d.id === lightestDayId) ?? trip.itinerary[0]
  if (!targetDay) return undefined

  const newSpot: Spot = {
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
    source: 'ai',
  }

  const last = targetDay.items[targetDay.items.length - 1]
  const baseTime = last?.plannedDeparture ?? last?.plannedArrival ?? '10:00'
  const arrival = last ? addMinutes(baseTime, 40) : baseTime
  const dayNumber = trip.itinerary.indexOf(targetDay) + 1

  const nearestExisting = [...trip.spots].sort(
    (a, b) => haversineKm(seed.location, a.location) - haversineKm(seed.location, b.location),
  )[0]
  const distanceNote = nearestExisting
    ? `既存の予定（${nearestExisting.name}）から約 ${haversineKm(seed.location, nearestExisting.location).toFixed(1)} km です。`
    : ''

  return makeProposal({
    trip,
    summary: `${seed.name}（${category}）を DAY${dayNumber} に追加します`,
    reason: `旅程内で最も予定に余裕がある DAY${dayNumber} に組み込みます。${distanceNote}`,
    benefits: [`${found}の予定が増える`, '既存ルートから大きく外れない'],
    drawbacks: ['1日の所要時間が増える', '他の予定を圧迫する可能性がある'],
    changes: [
      {
        kind: 'add_spot',
        dayId: targetDay.id,
        spot: newSpot,
        plannedArrival: arrival,
        label: `${seed.name} を DAY${dayNumber} に追加`,
      },
    ],
    estimatedTimeDeltaMin: seed.estimatedStayMin ?? 60,
    confidence: 0.6,
  })
}

/** 「N日目は17時までにホテルに着きたい」: 到着目標時刻から逆算して滞在を短縮する。 */
function ruleArriveByTime(ctx: RuleContext, text: string): AIProposal | undefined {
  const m = /(\d{1,2})\s*[時:](\d{2})?/.exec(text)
  if (!m || !/着きたい|着く|までに/.test(text)) return undefined
  const targetMin = Number(m[1]) * 60 + Number(m[2] ?? 0)
  const dayIdx = dayIndexFromText(text)
  const { trip } = ctx
  const day = dayIdx !== undefined ? trip.itinerary[dayIdx] : trip.itinerary[trip.itinerary.length - 1]
  if (!day || day.items.length === 0) return undefined

  const last = day.items[day.items.length - 1]
  const finishMin = toMinutes(last.plannedDeparture ?? last.plannedArrival)
  if (finishMin === undefined || finishMin <= targetMin) return undefined

  const overage = finishMin - targetMin
  // 最も滞在時間が長い予定を短縮対象にする
  const spotById = ctx.spotById
  const longest = [...day.items]
    .map((i) => ({
      item: i,
      stay:
        (toMinutes(i.plannedDeparture) ?? 0) - (toMinutes(i.plannedArrival) ?? 0) ||
        spotById.get(i.spotId)?.estimatedStayMin ||
        60,
    }))
    .sort((a, b) => b.stay - a.stay)[0]
  if (!longest || longest.stay - overage < 20) return undefined

  const spot = spotById.get(longest.item.spotId)
  const dayNumber = trip.itinerary.indexOf(day) + 1
  const newDeparture = longest.item.plannedDeparture
    ? addMinutes(longest.item.plannedDeparture, -overage)
    : undefined

  return makeProposal({
    trip,
    summary: `${spot?.name ?? 'その予定'} の滞在を ${overage} 分短くして、${m[1]}時${m[2] ?? '00'}分までに間に合わせます`,
    reason: `DAY${dayNumber} は現在の予定だと ${formatDuration(finishMin)} 頃までかかる見込みです。目標の ${m[1]}時${m[2] ?? '00'}分より ${formatDuration(overage)} オーバーしています。`,
    benefits: ['目標時刻に間に合う', '他の予定は変えなくてよい'],
    drawbacks: [`${spot?.name ?? 'その場所'} での滞在時間が短くなる`],
    changes: newDeparture
      ? [
          {
            kind: 'update_time',
            itemId: longest.item.id,
            plannedDeparture: newDeparture,
            label: `${spot?.name ?? '予定'} の出発を ${newDeparture} に変更`,
          },
        ]
      : [],
    estimatedTimeDeltaMin: -overage,
    confidence: 0.65,
  })
}

/** 「食事を重視して」: 食事枠がない日に候補を1件足す。 */
function ruleFocusMeals(ctx: RuleContext, text: string): AIProposal | undefined {
  if (!/食事.*(重視|増やし|足し)/.test(text)) return undefined
  const { trip } = ctx
  const missingDay = trip.itinerary.find((d) => !d.items.some((i) => i.type === 'meal') && d.items.length > 0)
  if (!missingDay) return undefined

  const usedNames = new Set(trip.spots.map((s) => s.name))
  const pool = Object.values(spotSeeds)
    .flat()
    .filter((s) => s.category === '食事' && !usedNames.has(s.name))
  const base = centroid(missingDay.items.map((i) => ctx.spotById.get(i.spotId)?.location).filter((p): p is { lat: number; lng: number } => Boolean(p)))
  const seed = [...pool].sort((a, b) => haversineKm(base, a.location) - haversineKm(base, b.location))[0]
  if (!seed) return undefined

  const newSpot: Spot = {
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
    source: 'ai',
  }

  const dayNumber = trip.itinerary.indexOf(missingDay) + 1
  return makeProposal({
    trip,
    summary: `DAY${dayNumber} に昼食（${seed.name}）を追加します`,
    reason: `DAY${dayNumber} には食事の予定が入っていません。近くの ${seed.name} を昼どき（12:00頃）に組み込みます。`,
    benefits: ['食事の予定が確保される'],
    drawbacks: ['他の予定の時間が後ろにずれる可能性がある'],
    changes: [
      {
        kind: 'add_spot',
        dayId: missingDay.id,
        spot: newSpot,
        plannedArrival: '12:00',
        label: `${seed.name} を DAY${dayNumber} 昼食に追加`,
      },
    ],
    estimatedTimeDeltaMin: seed.estimatedStayMin ?? 60,
    confidence: 0.64,
  })
}

/** 「予算を◯◯円以内にして」: 超過分を裁量枠（activity）から削る目安を出す。 */
function ruleBudgetCap(ctx: RuleContext, text: string): AIProposal | undefined {
  const m = /(\d[\d,]*)\s*万?\s*円\s*(以内|以下)/.exec(text)
  if (!m) return undefined
  const raw = Number(m[1].replace(/,/g, ''))
  const capYen = text.slice(m.index, m.index + m[0].length).includes('万') ? raw * 10000 : raw

  const { trip } = ctx
  const plannedTotal = Object.values(trip.budget.planned).reduce((a, b) => a + b, 0)
  const overage = plannedTotal - capYen
  if (overage <= 0) return undefined

  const category: BudgetCategory =
    trip.budget.planned.activity >= overage
      ? 'activity'
      : (Object.entries(trip.budget.planned).sort((a, b) => b[1] - a[1])[0][0] as BudgetCategory)
  const newValue = Math.max(0, trip.budget.planned[category] - overage)

  return makeProposal({
    trip,
    summary: `予算合計を ${capYen.toLocaleString('ja-JP')} 円以内に収めるため、${category} を見直します`,
    reason: `現在の計画予算は合計 ${plannedTotal.toLocaleString('ja-JP')} 円で、目標より ${overage.toLocaleString('ja-JP')} 円超過しています。最も配分の大きい項目から削ります。`,
    benefits: ['目標予算内に収まる見込みが立つ'],
    drawbacks: ['体験や宿泊のグレードを下げる必要が出る可能性がある'],
    changes: [
      {
        kind: 'adjust_budget',
        category,
        value: newValue,
        label: `${category} の予算を ${newValue.toLocaleString('ja-JP')} 円に調整`,
      },
    ],
    previewBudgetPlanned: { ...trip.budget.planned, [category]: newValue },
    estimatedBudgetDelta: -overage,
    confidence: 0.55,
  })
}

/** 「DAYxの空き時間に候補を追加して」: カテゴリ指定なしで、日付を軸に近場の候補を1件足す。 */
function ruleFreeTimeSlot(ctx: RuleContext, text: string): AIProposal | undefined {
  if (!/空き時間.*候補/.test(text)) return undefined
  const dayIdx = dayIndexFromText(text)
  const { trip } = ctx
  const day = dayIdx !== undefined ? trip.itinerary[dayIdx] : undefined
  if (!day || day.items.length === 0) return undefined

  const usedNames = new Set(trip.spots.map((s) => s.name))
  const dayLocations = day.items
    .map((i) => ctx.spotById.get(i.spotId)?.location)
    .filter((p): p is { lat: number; lng: number } => Boolean(p))
  if (dayLocations.length === 0) return undefined
  const base = centroid(dayLocations)

  const pool = Object.values(spotSeeds)
    .flat()
    .filter((s) => !usedNames.has(s.name))
  const seed = [...pool].sort((a, b) => haversineKm(base, a.location) - haversineKm(base, b.location))[0]
  if (!seed) return undefined

  const newSpot: Spot = {
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
    source: 'ai',
  }

  const last = day.items[day.items.length - 1]
  const arrival = last?.plannedDeparture ?? last?.plannedArrival ?? '13:00'
  const dayNumber = trip.itinerary.indexOf(day) + 1

  return makeProposal({
    trip,
    summary: `空いている時間に ${seed.name}（${seed.category}）を追加します`,
    reason: `DAY${dayNumber} の予定の近くにある ${seed.name} です。移動を大きく増やさずに組み込めます。`,
    benefits: ['空き時間を有効に使える'],
    drawbacks: ['予定していたゆとりが減る'],
    changes: [
      {
        kind: 'add_spot',
        dayId: day.id,
        spot: newSpot,
        plannedArrival: arrival,
        label: `${seed.name} を DAY${dayNumber} に追加`,
      },
    ],
    estimatedTimeDeltaMin: seed.estimatedStayMin ?? 60,
    confidence: 0.58,
  })
}

/** 「雨ならどうする？」: 雨天プラン自体は今後の対応（Phase 2）。現状把握だけ返す。 */
function ruleRainQuery(ctx: RuleContext, text: string): AIProposal | undefined {
  if (!/雨/.test(text)) return undefined
  const { trip } = ctx
  const outdoorHeavyDays = trip.itinerary.filter((d) =>
    d.items.some((i) => {
      const spot = ctx.spotById.get(i.spotId)
      return spot && ['自然', '絶景', '海'].includes(spot.category)
    }),
  )
  const dayNumbers = outdoorHeavyDays.map((d) => trip.itinerary.indexOf(d) + 1)
  return makeProposal({
    trip,
    summary: '雨天プランの自動切り替えは準備中です',
    reason: dayNumbers.length
      ? `屋外中心の予定がある日は DAY${dayNumbers.join('・DAY')} です。雨天時は屋内スポットへの差し替えを検討してください。`
      : '屋外中心の予定は特にありません。',
    benefits: [],
    drawbacks: [],
    changes: [],
    confidence: 0.3,
  })
}

const RULES = [
  ruleSlowDown,
  ruleReduceDistance,
  ruleAddCategory,
  ruleFreeTimeSlot,
  ruleArriveByTime,
  ruleFocusMeals,
  ruleBudgetCap,
  ruleRainQuery,
]

export function proposeItineraryChanges(trip: Trip, request: string): AIProposal[] {
  const ctx: RuleContext = { trip, spotById: new Map(trip.spots.map((s) => [s.id, s])) }
  const text = request.trim()
  const results: AIProposal[] = []

  for (const rule of RULES) {
    const proposal = rule(ctx, text)
    if (proposal) results.push(proposal)
    if (results.length >= 3) break
  }

  if (results.length === 0) {
    results.push(
      makeProposal({
        trip,
        summary: 'この内容はまだうまく解釈できませんでした',
        reason:
          '現在対応できる言い回しの例: 「2日目をゆっくりにして」「移動距離を減らして」「温泉を追加して」「3日目は17時までにホテルに着きたい」「食事を重視して」「予算を20万円以内にして」',
        benefits: [],
        drawbacks: [],
        changes: [],
        confidence: 0,
      }),
    )
  }

  return results
}
