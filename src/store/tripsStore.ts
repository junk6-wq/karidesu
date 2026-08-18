import { create } from 'zustand'
import type {
  AIProposal,
  Budget,
  BudgetCategory,
  Companion,
  ItineraryDay,
  ItineraryItem,
  ItineraryWarning,
  MemoryEntry,
  Spot,
  SpotPriority,
  Trip,
  TripStatus,
} from '@/types'
import { uid } from '@/lib/id'
import { load, save } from '@/lib/storage/local'
import { addMinutes, dateRange, daysUntil } from '@/lib/time'
import { aiAgent } from '@/lib/providers/mockAgent'
import { seedTrips } from '@/lib/seedTrips'
import { applyChangesToItinerary } from '@/lib/aiProposals'

const STORAGE_KEY = 'trips'

export const emptyBudget = (): Budget => ({
  currency: 'JPY',
  planned: { stay: 0, food: 0, transit: 0, activity: 0, other: 0 },
  actual: { stay: 0, food: 0, transit: 0, activity: 0, other: 0 },
})

/** 日付から自動的に決まるステータス。手動の planning だけは尊重する。 */
export function deriveStatus(trip: Trip): TripStatus {
  const untilStart = daysUntil(trip.startDate)
  const untilEnd = daysUntil(trip.endDate)
  if (untilEnd < 0) return 'completed'
  if (untilStart <= 0 && untilEnd >= 0) return 'journey'
  return trip.status === 'planning' ? 'planning' : 'upcoming'
}

interface TripsState {
  trips: Trip[]
  warnings: Record<string, ItineraryWarning[]>
  agentBusy: boolean

  createTrip(input: {
    title: string
    destination: string
    startDate: string
    endDate: string
    coverPhotoUrl?: string
    spots?: Spot[]
    itinerary?: ItineraryDay[]
    budget?: Budget
  }): Trip
  updateTrip(id: string, patch: Partial<Trip>): void
  deleteTrip(id: string): void
  getTrip(id: string): Trip | undefined

  addSpot(tripId: string, spot: Omit<Spot, 'id'>): Spot
  updateSpot(tripId: string, spotId: string, patch: Partial<Spot>): void
  removeSpot(tripId: string, spotId: string): void

  addItem(tripId: string, dayId: string, item: Omit<ItineraryItem, 'id'>): void
  updateItem(tripId: string, itemId: string, patch: Partial<ItineraryItem>): void
  removeItem(tripId: string, itemId: string): void
  reorderItems(tripId: string, dayId: string, orderedIds: string[]): void
  moveItemToDay(tripId: string, itemId: string, toDayId: string, index?: number): void

  setPlannedBudget(tripId: string, category: BudgetCategory, value: number): void
  setActualBudget(tripId: string, category: BudgetCategory, value: number): void

  runOptimize(tripId: string): Promise<void>
  setMemory(tripId: string, memory: MemoryEntry): void

  addCompanion(tripId: string, name: string): void
  removeCompanion(tripId: string, companionId: string): void
  setCompanionRole(tripId: string, companionId: string, role: Companion['role']): void

  /** AI 提案をユーザーが承認した後に、旅程・予算へ一括反映する。 */
  applyProposal(tripId: string, proposal: AIProposal): void
  setSpotPriority(tripId: string, spotId: string, priority: SpotPriority | undefined): void
  /** 予定を複製し、同じ日の直後に少し後ろの時間で挿入する。 */
  duplicateItem(tripId: string, itemId: string): void
  moveItemUp(tripId: string, dayId: string, itemId: string): void
  moveItemDown(tripId: string, dayId: string, itemId: string): void
}

function persist(trips: Trip[]) {
  save(STORAGE_KEY, trips)
}

/**
 * 初回起動時はデモデータを作って即座に保存する。
 * 保存しないと再読み込みのたびに ID が変わり、URL 直打ちや共有リンクが壊れる。
 */
function initialTrips(): Trip[] {
  const stored = load<Trip[] | null>(STORAGE_KEY, null)
  if (stored) return stored
  const seeded = seedTrips()
  persist(seeded)
  return seeded
}

function touch(trip: Trip): Trip {
  return { ...trip, updatedAt: new Date().toISOString(), status: deriveStatus(trip) }
}

export const useTripsStore = create<TripsState>((set, get) => ({
  trips: initialTrips(),
  warnings: {},
  agentBusy: false,

  createTrip(input) {
    const now = new Date().toISOString()
    const days =
      input.itinerary ??
      dateRange(input.startDate, input.endDate).map((date) => ({
        id: uid('day'),
        date,
        items: [],
      }))

    const trip: Trip = {
      id: uid('trip'),
      title: input.title,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      coverPhotoUrl: input.coverPhotoUrl,
      status: 'planning',
      budget: input.budget ?? emptyBudget(),
      itinerary: days,
      spots: input.spots ?? [],
      companions: [{ id: uid('cmp'), name: 'あなた', role: 'organizer' }],
      createdAt: now,
      updatedAt: now,
    }
    const next = [touch(trip), ...get().trips]
    set({ trips: next })
    persist(next)
    return trip
  },

  updateTrip(id, patch) {
    const next = get().trips.map((t) => (t.id === id ? touch({ ...t, ...patch }) : t))
    set({ trips: next })
    persist(next)
  },

  deleteTrip(id) {
    const next = get().trips.filter((t) => t.id !== id)
    set({ trips: next })
    persist(next)
  },

  getTrip(id) {
    return get().trips.find((t) => t.id === id)
  },

  addSpot(tripId, spot) {
    const created: Spot = { ...spot, id: uid('spot') }
    const next = get().trips.map((t) =>
      t.id === tripId ? touch({ ...t, spots: [...t.spots, created] }) : t,
    )
    set({ trips: next })
    persist(next)
    return created
  },

  updateSpot(tripId, spotId, patch) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            spots: t.spots.map((s) => (s.id === spotId ? { ...s, ...patch } : s)),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  removeSpot(tripId, spotId) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            spots: t.spots.filter((s) => s.id !== spotId),
            itinerary: t.itinerary.map((d) => ({
              ...d,
              items: d.items.filter((i) => i.spotId !== spotId),
            })),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  addItem(tripId, dayId, item) {
    const created: ItineraryItem = { ...item, id: uid('item') }
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            itinerary: t.itinerary.map((d) =>
              d.id === dayId ? { ...d, items: [...d.items, created] } : d,
            ),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  updateItem(tripId, itemId, patch) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            itinerary: t.itinerary.map((d) => ({
              ...d,
              items: d.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            })),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  removeItem(tripId, itemId) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            itinerary: t.itinerary.map((d) => ({
              ...d,
              items: d.items.filter((i) => i.id !== itemId),
            })),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  reorderItems(tripId, dayId, orderedIds) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      return touch({
        ...t,
        itinerary: t.itinerary.map((d) => {
          if (d.id !== dayId) return d
          const byId = new Map(d.items.map((i) => [i.id, i]))
          const reordered = orderedIds
            .map((id) => byId.get(id))
            .filter((i): i is ItineraryItem => Boolean(i))
          // orderedIds に含まれないものは末尾に残す（取りこぼし防止）
          const rest = d.items.filter((i) => !orderedIds.includes(i.id))
          return { ...d, items: [...reordered, ...rest] }
        }),
      })
    })
    set({ trips: next })
    persist(next)
  },

  moveItemToDay(tripId, itemId, toDayId, index) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      let moving: ItineraryItem | undefined
      const stripped = t.itinerary.map((d) => {
        const found = d.items.find((i) => i.id === itemId)
        if (found) moving = found
        return { ...d, items: d.items.filter((i) => i.id !== itemId) }
      })
      if (!moving) return t
      return touch({
        ...t,
        itinerary: stripped.map((d) => {
          if (d.id !== toDayId) return d
          const items = [...d.items]
          items.splice(index ?? items.length, 0, moving as ItineraryItem)
          return { ...d, items }
        }),
      })
    })
    set({ trips: next })
    persist(next)
  },

  setPlannedBudget(tripId, category, value) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            budget: { ...t.budget, planned: { ...t.budget.planned, [category]: value } },
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  setActualBudget(tripId, category, value) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            budget: {
              ...t.budget,
              actual: {
                ...(t.budget.actual ?? emptyBudget().planned),
                [category]: value,
              },
            },
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  async runOptimize(tripId) {
    const trip = get().getTrip(tripId)
    if (!trip) return
    set({ agentBusy: true })
    try {
      const { days, warnings } = await aiAgent.optimizeItinerary(trip)
      const next = get().trips.map((t) => (t.id === tripId ? touch({ ...t, itinerary: days }) : t))
      set({ trips: next, warnings: { ...get().warnings, [tripId]: warnings } })
      persist(next)
    } finally {
      set({ agentBusy: false })
    }
  },

  setMemory(tripId, memory) {
    const next = get().trips.map((t) => (t.id === tripId ? touch({ ...t, memory }) : t))
    set({ trips: next })
    persist(next)
  },

  addCompanion(tripId, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const companion: Companion = { id: uid('cmp'), name: trimmed, role: 'member' }
    const next = get().trips.map((t) =>
      t.id === tripId ? touch({ ...t, companions: [...t.companions, companion] }) : t,
    )
    set({ trips: next })
    persist(next)
  },

  removeCompanion(tripId, companionId) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({ ...t, companions: t.companions.filter((c) => c.id !== companionId) })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  setCompanionRole(tripId, companionId, role) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            companions: t.companions.map((c) => (c.id === companionId ? { ...c, role } : c)),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  applyProposal(tripId, proposal) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      // add_spot 系の変更は新規 Spot も一緒に持ってくるので、trip.spots にも登録する
      const newSpots = proposal.changes.flatMap((c) => (c.kind === 'add_spot' ? [c.spot] : []))
      const spots = newSpots.length ? [...t.spots, ...newSpots] : t.spots

      const itinerary = applyChangesToItinerary(t.itinerary, proposal.changes)

      const budgetChange = proposal.changes.find((c) => c.kind === 'adjust_budget')
      const budget =
        budgetChange && budgetChange.kind === 'adjust_budget'
          ? { ...t.budget, planned: { ...t.budget.planned, [budgetChange.category]: budgetChange.value } }
          : t.budget

      return touch({ ...t, spots, itinerary, budget })
    })
    set({ trips: next })
    persist(next)
  },

  setSpotPriority(tripId, spotId, priority) {
    const next = get().trips.map((t) =>
      t.id === tripId
        ? touch({
            ...t,
            spots: t.spots.map((s) => (s.id === spotId ? { ...s, priority } : s)),
          })
        : t,
    )
    set({ trips: next })
    persist(next)
  },

  duplicateItem(tripId, itemId) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      return touch({
        ...t,
        itinerary: t.itinerary.map((d) => {
          const index = d.items.findIndex((i) => i.id === itemId)
          if (index === -1) return d
          const original = d.items[index]
          const copy: ItineraryItem = {
            ...original,
            id: uid('item'),
            plannedArrival: original.plannedArrival ? addMinutes(original.plannedArrival, 30) : undefined,
            plannedDeparture: original.plannedDeparture
              ? addMinutes(original.plannedDeparture, 30)
              : undefined,
            actualArrival: undefined,
            actualDeparture: undefined,
          }
          const items = [...d.items]
          items.splice(index + 1, 0, copy)
          return { ...d, items }
        }),
      })
    })
    set({ trips: next })
    persist(next)
  },

  moveItemUp(tripId, dayId, itemId) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      return touch({
        ...t,
        itinerary: t.itinerary.map((d) => {
          if (d.id !== dayId) return d
          const index = d.items.findIndex((i) => i.id === itemId)
          if (index <= 0) return d
          const items = [...d.items]
          ;[items[index - 1], items[index]] = [items[index], items[index - 1]]
          return { ...d, items }
        }),
      })
    })
    set({ trips: next })
    persist(next)
  },

  moveItemDown(tripId, dayId, itemId) {
    const next = get().trips.map((t) => {
      if (t.id !== tripId) return t
      return touch({
        ...t,
        itinerary: t.itinerary.map((d) => {
          if (d.id !== dayId) return d
          const index = d.items.findIndex((i) => i.id === itemId)
          if (index === -1 || index >= d.items.length - 1) return d
          const items = [...d.items]
          ;[items[index], items[index + 1]] = [items[index + 1], items[index]]
          return { ...d, items }
        }),
      })
    })
    set({ trips: next })
    persist(next)
  },
}))

/* --- セレクタ --- */

export function useTrip(id: string | undefined): Trip | undefined {
  return useTripsStore((s) => (id ? s.trips.find((t) => t.id === id) : undefined))
}

export function useTripWarnings(id: string | undefined): ItineraryWarning[] {
  return useTripsStore((s) => (id ? (s.warnings[id] ?? []) : []))
}

/** Home の並び: 進行中 → 出発が近い順 → 完了。 */
export function sortTripsForShelf(trips: Trip[]): Trip[] {
  const rank: Record<TripStatus, number> = { journey: 0, upcoming: 1, planning: 2, completed: 3 }
  return [...trips].sort((a, b) => {
    const sa = deriveStatus(a)
    const sb = deriveStatus(b)
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb]
    return a.startDate.localeCompare(b.startDate) * (sa === 'completed' ? -1 : 1)
  })
}
