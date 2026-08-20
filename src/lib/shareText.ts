import type { Trip } from '@/types'
import { formatCurrency, formatKm } from '@/lib/format'
import { formatDateDot, formatDateRange, weekdayJa } from '@/lib/time'
import { effectiveSpend, tripStats } from '@/lib/tripStats'

/**
 * 共有用テキスト。受け取った相手が「いつ・どこを・どの順で回るか」を
 * ひと目で掴めるよう、要約だけでなく DAY ごとの行程を本文に入れる。
 */
export function buildShareText(trip: Trip): string {
  const stats = tripStats(trip)
  const spend = effectiveSpend(trip)
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))

  const lines: string[] = [
    `${trip.title} — ${formatDateRange(trip.startDate, trip.endDate)}`,
    `${trip.destination} / ${stats.dayCount}日間`,
    '',
  ]

  trip.itinerary.forEach((day, i) => {
    lines.push(`DAY ${String(i + 1).padStart(2, '0')}  ${formatDateDot(day.date)}(${weekdayJa(day.date)})`)
    if (day.items.length === 0) {
      lines.push('  （予定なし）')
    } else {
      day.items.forEach((item) => {
        const name = spotById.get(item.spotId)?.name ?? '予定'
        const time = item.plannedArrival ?? '--:--'
        lines.push(`  ${time}  ${name}`)
      })
    }
    lines.push('')
  })

  if (trip.memory?.narrative) {
    lines.push(trip.memory.narrative, '')
  }

  lines.push(
    `${stats.itemCount} spots / ${formatKm(stats.distanceKm)} / ${formatCurrency(spend, trip.budget.currency)}`,
    '— PASSAGE',
  )

  return lines.join('\n')
}
