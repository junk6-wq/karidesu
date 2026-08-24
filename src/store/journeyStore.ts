import { create } from 'zustand'
import type { GeoPoint, ItineraryItem, JourneyState, JourneyStatus, Spot, Trip } from '@/types'
import { estimateDurationMin, haversineKm } from '@/lib/geo'
import { nowHHMM, toISODate, toMinutes } from '@/lib/time'
import { load, save } from '@/lib/storage/local'
import { mapProvider } from '@/lib/providers/localMap'

const STORAGE_KEY = 'journey'

/** 遅延判定のしきい値（分）。MVP はこのローカルロジック、将来 AI 検知に置換。 */
const AT_RISK_MIN = 5
const DELAYED_MIN = 15

export interface JourneyContext {
  state: JourneyState
  nextItem?: ItineraryItem
  nextSpot?: Spot
  todayItems: ItineraryItem[]
  /** 今日が旅の何日目か（1 始まり）。見つからなければ undefined */
  dayNumber?: number
  /** 旅の総日数 */
  dayCount: number
  /** 今日の予定のうち到着済みの数 */
  doneCount: number
  /** 次の目的地までの推定移動時間（分, 現在地不明なら undefined） */
  etaMin?: number
  /** 次の目的地までの推定距離（km, 現在地不明なら undefined） */
  distanceKm?: number
  /** 出発すべき時刻までの残り（分）。負なら出発すべき時刻を過ぎている */
  leaveInMin?: number
}

interface JourneyStore {
  states: Record<string, JourneyState>
  /** 手動報告で積み増す遅延（分）。GPS が使えない場面のフォールバック */
  manualDelay: Record<string, number>
  watching: boolean

  startWatch(tripId: string): () => void
  setLocation(tripId: string, p: GeoPoint): void
  reportDelay(tripId: string, minutes: number): void
  clearDelay(tripId: string): void
  recompute(tripId: string, trip: Trip): void
  getState(tripId: string): JourneyState
}

function blank(tripId: string): JourneyState {
  return {
    tripId,
    delayMinutes: 0,
    status: 'on_time',
    lastUpdated: new Date().toISOString(),
  }
}

function statusFor(delay: number): JourneyStatus {
  if (delay >= DELAYED_MIN) return 'delayed'
  if (delay >= AT_RISK_MIN) return 'at_risk'
  return 'on_time'
}

export const useJourneyStore = create<JourneyStore>((set, get) => ({
  states: load<Record<string, JourneyState>>(STORAGE_KEY, {}),
  manualDelay: load<Record<string, number>>('journey-manual', {}),
  watching: false,

  getState(tripId) {
    return get().states[tripId] ?? blank(tripId)
  },

  startWatch(tripId) {
    set({ watching: true })
    const stop = mapProvider.watchCurrentLocation((p) => get().setLocation(tripId, p))
    return () => {
      stop()
      set({ watching: false })
    }
  },

  setLocation(tripId, p) {
    const prev = get().getState(tripId)
    const states = {
      ...get().states,
      [tripId]: { ...prev, currentLocation: p, lastUpdated: new Date().toISOString() },
    }
    set({ states })
    save(STORAGE_KEY, states)
  },

  reportDelay(tripId, minutes) {
    const manualDelay = { ...get().manualDelay, [tripId]: (get().manualDelay[tripId] ?? 0) + minutes }
    set({ manualDelay })
    save('journey-manual', manualDelay)
  },

  clearDelay(tripId) {
    const manualDelay = { ...get().manualDelay, [tripId]: 0 }
    set({ manualDelay })
    save('journey-manual', manualDelay)
  },

  /**
   * 予定時刻・現在地・手動報告から遅延を算出する。
   * 「今どこにいて、次にどこへ向かうか」だけで決まるようにしてある。
   */
  recompute(tripId, trip) {
    const prev = get().getState(tripId)
    const ctx = buildContext(trip, prev, get().manualDelay[tripId] ?? 0)
    const nextState: JourneyState = {
      ...prev,
      tripId,
      nextItemId: ctx.nextItem?.id,
      delayMinutes: ctx.state.delayMinutes,
      status: ctx.state.status,
      lastUpdated: new Date().toISOString(),
    }
    // 値が動いていないなら再レンダリングを起こさない
    if (
      prev.nextItemId === nextState.nextItemId &&
      prev.delayMinutes === nextState.delayMinutes &&
      prev.status === nextState.status
    ) {
      return
    }
    const states = { ...get().states, [tripId]: nextState }
    set({ states })
    save(STORAGE_KEY, states)
  },
}))

/**
 * 旅の現在地点を組み立てる。ストア外でも使えるよう純関数にしてある。
 */
export function buildContext(
  trip: Trip,
  state: JourneyState,
  manualDelay = 0,
  now = new Date(),
): JourneyContext {
  const todayISO = toISODate(now)
  const today =
    trip.itinerary.find((d) => d.date === todayISO) ??
    trip.itinerary.find((d) => d.date >= todayISO) ??
    trip.itinerary[trip.itinerary.length - 1]

  const todayItems = today?.items ?? []
  const nextItem = todayItems.find((i) => !i.actualArrival)
  const doneCount = todayItems.filter((i) => i.actualArrival).length
  const nextSpot = trip.spots.find((s) => s.id === nextItem?.spotId)

  const nowMin = toMinutes(nowHHMM(now)) ?? 0
  const plannedArrivalMin = toMinutes(nextItem?.plannedArrival)

  let etaMin: number | undefined
  let distanceKm: number | undefined
  if (state.currentLocation && nextSpot) {
    distanceKm = haversineKm(state.currentLocation, nextSpot.location)
    etaMin = estimateDurationMin(distanceKm, 'car')
  }

  let delayMinutes = manualDelay
  let leaveInMin: number | undefined

  if (plannedArrivalMin !== undefined) {
    if (etaMin !== undefined) {
      // 現在地が取れているなら「今出れば間に合うか」で判定する
      delayMinutes += nowMin + etaMin - plannedArrivalMin
      leaveInMin = plannedArrivalMin - etaMin - nowMin
    } else {
      // 取れないときは予定時刻との単純な差
      delayMinutes += nowMin - plannedArrivalMin
    }
  }

  const rounded = Math.round(delayMinutes)
  return {
    state: {
      ...state,
      nextItemId: nextItem?.id,
      delayMinutes: rounded,
      status: statusFor(rounded),
    },
    nextItem,
    nextSpot,
    todayItems,
    dayNumber: today ? trip.itinerary.indexOf(today) + 1 : undefined,
    dayCount: trip.itinerary.length,
    doneCount,
    etaMin,
    distanceKm,
    leaveInMin: leaveInMin === undefined ? undefined : Math.round(leaveInMin),
  }
}
