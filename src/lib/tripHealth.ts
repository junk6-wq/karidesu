import type { DayLoad, ItineraryDay, ItineraryWarning, LoadLevel, Trip, TripHealth } from '@/types'
import { toMinutes } from '@/lib/time'

/** 屋外中心＝天候の影響を受けやすいカテゴリ。ヒューリスティックな分類で厳密な科学的指標ではない。 */
const OUTDOOR_CATEGORIES = new Set(['自然', '絶景', '海', '街歩き'])

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function levelOf(score: number): LoadLevel {
  if (score >= 75) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

/**
 * DAY ごとの負荷スコア（0–100、高いほど詰め込み気味）。
 * スポット数・移動時間・滞在時間・早朝/深夜予定・空き時間不足から算出する。
 * 移動区間（travelToNext）が未計算だとこのスコアは実質カウント分しか動かないため、
 * runOptimize を通す前の旅程（Trip 作成中の取捨選択画面など）には使わない。
 */
export function evaluateDayLoadSync(trip: Trip): DayLoad[] {
  return trip.itinerary.map((day) => ({ dayId: day.id, ...scoreDay(day) }))
}

function scoreDay(day: ItineraryDay): { score: number; level: LoadLevel } {
  const items = day.items
  if (items.length === 0) return { score: 0, level: 'low' }

  let points = 0

  // スポット数（1件=0点、6件以上で頭打ち）
  points += Math.min(30, Math.max(0, items.length - 2) * 8)

  // 総移動時間
  const totalTravelMin = items.reduce((sum, i) => sum + (i.travelToNext?.durationMin ?? 0), 0)
  points += Math.min(25, (totalTravelMin / 180) * 25)

  // 早朝(8:00前)・深夜(20:00以降)の予定
  items.forEach((i) => {
    const arrival = toMinutes(i.plannedArrival)
    if (arrival !== undefined && arrival < 8 * 60) points += 8
    if (arrival !== undefined && arrival >= 20 * 60) points += 8
  })

  // 空き時間不足（移動直後すぐ次の予定が来る＝余裕がない）
  items.forEach((item, index) => {
    const next = items[index + 1]
    if (!next || !item.travelToNext) return
    const departure = toMinutes(item.plannedDeparture ?? item.plannedArrival)
    const nextArrival = toMinutes(next.plannedArrival)
    if (departure === undefined || nextArrival === undefined) return
    const slack = nextArrival - departure - item.travelToNext.durationMin
    if (slack < 10) points += 12
    else if (slack < 25) points += 5
  })

  return { score: clampScore(points), level: levelOf(clampScore(points)) }
}

/**
 * 旅全体の TRIP HEALTH スコア（0–100）と内訳。
 * ルールベースの目安値であり、厳密な指標ではない（8章）。
 */
export function evaluateTripHealthSync(trip: Trip, warnings: ItineraryWarning[]): TripHealth {
  const allItems = trip.itinerary.flatMap((d) => d.items)
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))

  // 移動効率: 移動時間 / (移動時間 + 滞在時間)
  const totalTravelMin = allItems.reduce((sum, i) => sum + (i.travelToNext?.durationMin ?? 0), 0)
  const totalStayMin = allItems.reduce((sum, i) => {
    const spot = spotById.get(i.spotId)
    return sum + (spot?.estimatedStayMin ?? 60)
  }, 0)
  const moveRatio = totalTravelMin + totalStayMin > 0 ? totalTravelMin / (totalTravelMin + totalStayMin) : 0
  const moveEfficiency = clampScore(100 - moveRatio * 160)

  // 営業時間・滞在余裕・予算: 該当カテゴリの警告数から減点
  const countBy = (cat: string) => warnings.filter((w) => w.category === cat).length
  const openingHours = clampScore(100 - countBy('opening_hours') * 30)
  const restMargin = clampScore(100 - countBy('rest_margin') * 20)
  const budget = clampScore(100 - countBy('budget') * 35)

  // 旅程密度: DayLoad の平均から
  const dayLoads = evaluateDayLoadSync(trip)
  const avgDayLoad = dayLoads.length
    ? dayLoads.reduce((s, d) => s + d.score, 0) / dayLoads.length
    : 0
  const density = clampScore(100 - avgDayLoad * 0.8)

  // 天候耐性: 屋外中心スポットの割合が高いほど低くなる
  const outdoorCount = allItems.filter((i) => {
    const spot = spotById.get(i.spotId)
    return spot && OUTDOOR_CATEGORIES.has(spot.category)
  }).length
  const outdoorRatio = allItems.length ? outdoorCount / allItems.length : 0
  const weatherResilience = clampScore(100 - outdoorRatio * 60)

  const breakdown = { moveEfficiency, openingHours, restMargin, budget, density, weatherResilience }
  const score = clampScore(
    (moveEfficiency + openingHours + restMargin + budget + density + weatherResilience) / 6,
  )

  return { score, breakdown }
}

/** 「旅程 78% 完成」の完成度。旅程登録・宿泊・予算・移動・検証済みを判断材料にする。 */
export function planCompleteness(trip: Trip, warnings: ItineraryWarning[]): number {
  const checks: boolean[] = []

  checks.push(trip.itinerary.some((d) => d.items.length > 0))
  checks.push(trip.itinerary.every((d) => d.items.length > 0))
  checks.push(Object.values(trip.budget.planned).some((v) => v > 0))
  checks.push(trip.spots.some((s) => (s.priceLevel ?? 0) > 0 || s.category === '温泉'))
  // 移動区間が計算済み＝一度は AI 検証（runOptimize）を通っている
  checks.push(
    trip.itinerary.some((d) => d.items.length > 1) &&
      trip.itinerary.some((d) => d.items.some((i) => i.travelToNext)),
  )
  checks.push(warnings.filter((w) => w.severity === 'risk').length === 0)
  checks.push(trip.companions.length > 0)

  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}
