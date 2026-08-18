import type { ItineraryDay, Spot } from '@/types'

export type DiffLineStatus = 'same' | 'new' | 'removed' | 'time_changed'

export interface DiffLine {
  itemId: string
  time: string
  name: string
  status: DiffLineStatus
}

export interface DiffDaySection {
  dayId: string
  dayNumber: number
  before: DiffLine[]
  after: DiffLine[]
}

function daySignature(day: ItineraryDay | undefined): string {
  if (!day) return ''
  return day.items.map((i) => `${i.id}:${i.plannedArrival ?? ''}:${i.plannedDeparture ?? ''}`).join('|')
}

/**
 * 「変更前 / 変更案」を DAY 単位で並べる差分表示用のデータを作る。
 * サインチャーが一致する（＝何も変わっていない）日は結果に含めない。
 */
export function computeItineraryDiff(
  before: ItineraryDay[],
  after: ItineraryDay[],
  spots: Spot[],
): DiffDaySection[] {
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? '—'
  const beforeById = new Map(before.map((d) => [d.id, d]))
  const afterById = new Map(after.map((d) => [d.id, d]))

  const sections: DiffDaySection[] = []

  before.forEach((day, index) => {
    const afterDay = afterById.get(day.id)
    if (daySignature(day) === daySignature(afterDay)) return

    const beforeTimes = new Map(day.items.map((i) => [i.id, i.plannedArrival ?? '']))
    const afterTimes = new Map((afterDay?.items ?? []).map((i) => [i.id, i.plannedArrival ?? '']))

    const beforeLines: DiffLine[] = day.items.map((i) => ({
      itemId: i.id,
      time: i.plannedArrival ?? '--:--',
      name: spotName(i.spotId),
      status: !afterTimes.has(i.id) ? 'removed' : afterTimes.get(i.id) !== beforeTimes.get(i.id) ? 'time_changed' : 'same',
    }))

    const afterLines: DiffLine[] = (afterDay?.items ?? []).map((i) => ({
      itemId: i.id,
      time: i.plannedArrival ?? '--:--',
      name: spotName(i.spotId),
      status: !beforeTimes.has(i.id) ? 'new' : beforeTimes.get(i.id) !== afterTimes.get(i.id) ? 'time_changed' : 'same',
    }))

    sections.push({ dayId: day.id, dayNumber: index + 1, before: beforeLines, after: afterLines })
  })

  // 元々存在しなかった DAY への追加（通常は起きないが念のため）
  after.forEach((day, index) => {
    if (beforeById.has(day.id)) return
    const lines: DiffLine[] = day.items.map((i) => ({
      itemId: i.id,
      time: i.plannedArrival ?? '--:--',
      name: spotName(i.spotId),
      status: 'new',
    }))
    sections.push({ dayId: day.id, dayNumber: index + 1, before: [], after: lines })
  })

  return sections
}
