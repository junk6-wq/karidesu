import type { ReplanSuggestion, Trip } from '@/types'
import { addMinutes } from '@/lib/time'

/**
 * 再提案（S10）を旅程に適用する。
 * 採用ワンタップで ItineraryDay を書き換え、THE THREAD に即反映させる。
 */
export function applyReplan(trip: Trip, suggestion: ReplanSuggestion): Trip['itinerary'] {
  const action = suggestion.action

  return trip.itinerary.map((day) => {
    switch (action.kind) {
      case 'shorten': {
        if (!day.items.some((i) => i.id === action.itemId)) return day
        return {
          ...day,
          items: day.items.map((i) =>
            i.id === action.itemId && i.plannedDeparture
              ? { ...i, plannedDeparture: addMinutes(i.plannedDeparture, -action.minutes) }
              : i,
          ),
        }
      }

      case 'swap': {
        const a = day.items.findIndex((i) => i.id === action.itemIdA)
        const b = day.items.findIndex((i) => i.id === action.itemIdB)
        if (a < 0 || b < 0) return day
        const items = [...day.items]
        // 予定時刻は枠として残し、中身（スポットと種別）だけ入れ替える
        const keepA = { spotId: items[a].spotId, type: items[a].type, notes: items[a].notes }
        const keepB = { spotId: items[b].spotId, type: items[b].type, notes: items[b].notes }
        items[a] = { ...items[a], ...keepB }
        items[b] = { ...items[b], ...keepA }
        return { ...day, items }
      }

      case 'drop': {
        if (!day.items.some((i) => i.id === action.itemId)) return day
        return { ...day, items: day.items.filter((i) => i.id !== action.itemId) }
      }

      case 'shift': {
        // 未到着の予定だけを後ろへずらす
        return {
          ...day,
          items: day.items.map((i) =>
            i.actualArrival
              ? i
              : {
                  ...i,
                  plannedArrival: i.plannedArrival
                    ? addMinutes(i.plannedArrival, action.minutes)
                    : i.plannedArrival,
                  plannedDeparture: i.plannedDeparture
                    ? addMinutes(i.plannedDeparture, action.minutes)
                    : i.plannedDeparture,
                },
          ),
        }
      }

      default:
        return day
    }
  })
}
