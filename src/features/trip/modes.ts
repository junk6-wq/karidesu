import type { Trip } from '@/types'
import { daysUntil } from '@/lib/time'

export type Mode = 'plan' | 'journey' | 'memory'

export interface ModeState {
  id: Mode
  label: string
  path: string
  unlocked: boolean
  /** ロック中に「次に何をすれば解禁されるか」を示す文言（4章） */
  lockedHint?: string
}

/**
 * 3 幕（PLAN / JOURNEY / MEMORY）の解禁状態。
 * 未到達のモードは THE THREAD が途切れた状態で見せ、解禁条件を必ず添える。
 */
export function modesFor(trip: Trip): ModeState[] {
  const untilStart = daysUntil(trip.startDate)
  const untilEnd = daysUntil(trip.endDate)

  const journeyUnlocked = untilStart <= 0 && untilEnd >= 0
  const memoryUnlocked = untilEnd < 0

  return [
    { id: 'plan', label: 'PLAN', path: `/trip/${trip.id}`, unlocked: true },
    {
      id: 'journey',
      label: 'JOURNEY',
      path: `/trip/${trip.id}/journey`,
      unlocked: journeyUnlocked,
      lockedHint: memoryUnlocked
        ? 'この旅は終わりました'
        : `出発日（あと ${untilStart} 日）に解禁されます`,
    },
    {
      id: 'memory',
      label: 'MEMORY',
      path: `/trip/${trip.id}/memory`,
      unlocked: memoryUnlocked,
      lockedHint:
        untilEnd >= 0 ? `帰着日（あと ${untilEnd} 日）を過ぎると編まれます` : undefined,
    },
  ]
}

export function currentMode(pathname: string): Mode {
  if (pathname.includes('/journey')) return 'journey'
  if (pathname.includes('/memory')) return 'memory'
  return 'plan'
}
