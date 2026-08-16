import type { BudgetCategory, GeoPoint, Trip } from '@/types'
import { haversineKm } from '@/lib/geo'
import { daysBetween, toISODate } from '@/lib/time'

export interface TripStats {
  dayCount: number
  spotCount: number
  itemCount: number
  /** 旅程順に繋いだ総距離（km）。MVP は直線距離の和で近似する */
  distanceKm: number
  plannedTotal: number
  actualTotal: number
  /** 0–1。THE THREAD の塗り具合 */
  progress: number
  route: GeoPoint[]
}

export const BUDGET_LABELS: Record<BudgetCategory, string> = {
  stay: '宿',
  food: '食事',
  transit: '移動',
  activity: '体験',
  other: 'その他',
}

export const BUDGET_ORDER: BudgetCategory[] = ['stay', 'food', 'transit', 'activity', 'other']

export function tripStats(trip: Trip, today = new Date()): TripStats {
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))
  const route: GeoPoint[] = []
  let itemCount = 0

  trip.itinerary.forEach((day) => {
    day.items.forEach((item) => {
      const spot = spotById.get(item.spotId)
      if (!spot) return
      itemCount += 1
      route.push(spot.location)
    })
  })

  let distanceKm = 0
  for (let i = 1; i < route.length; i += 1) {
    distanceKm += haversineKm(route[i - 1], route[i])
  }

  const plannedTotal = Object.values(trip.budget.planned).reduce((a, b) => a + b, 0)
  const actualTotal = Object.values(trip.budget.actual ?? {}).reduce((a, b) => a + b, 0)

  return {
    dayCount: trip.itinerary.length,
    spotCount: trip.spots.length,
    itemCount,
    distanceKm: Number(distanceKm.toFixed(1)),
    plannedTotal,
    actualTotal,
    progress: tripProgress(trip, today),
    route,
  }
}

/**
 * 旅の進行度（0–1）。
 * 旅の前は 0、旅の後は 1、旅の最中は「経過日数 + 今日の到着済み割合」で出す。
 * この値が THE THREAD の塗り具合そのものになる。
 */
export function tripProgress(trip: Trip, today = new Date()): number {
  const todayISO = toISODate(today)
  const total = Math.max(1, daysBetween(trip.startDate, trip.endDate) + 1)
  const elapsed = daysBetween(trip.startDate, todayISO)

  if (elapsed < 0) return 0
  if (elapsed >= total) return 1

  const day = trip.itinerary.find((d) => d.date === todayISO)
  const items = day?.items ?? []
  const doneToday = items.length
    ? items.filter((i) => i.actualArrival).length / items.length
    : 0

  return Math.min(1, (elapsed + doneToday) / total)
}

/** 実績が 1 円も入っていなければ計画値を実績とみなす（MEMORY の集計用）。 */
export function effectiveSpend(trip: Trip): number {
  const actual = Object.values(trip.budget.actual ?? {}).reduce((a, b) => a + b, 0)
  if (actual > 0) return actual
  return Object.values(trip.budget.planned).reduce((a, b) => a + b, 0)
}
