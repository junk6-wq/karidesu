import type { Trip } from '@/types'
import type { Mode } from './modes'

export interface SectionState {
  id: string
  label: string
  path: string
  /** 完全一致で現在地を判定する（インデックスルート用）。 */
  exact?: boolean
}

/**
 * モード内のセクション（4章の IA を実際に辿れるようにするための第2階層）。
 *
 * モードタブだけだと PLAN 配下の 4 画面へは Overview 最下部のボタンからしか
 * 行けず、画面間の横移動のたびにハブへ戻る必要があった。常設のセクションタブに
 * することで、どの画面からでも隣の画面へ 1 タップで移動できる。
 *
 * JOURNEY は没入表示（TripLayout の chrome を出さない）ため、ここでは扱わない。
 * ルート画面への導線は JourneyScreen 下部の操作バーが担う。
 */
export function sectionsFor(trip: Trip, mode: Mode): SectionState[] {
  if (mode === 'plan') {
    return [
      { id: 'overview', label: '概要', path: `/trip/${trip.id}`, exact: true },
      { id: 'itinerary', label: '旅程', path: `/trip/${trip.id}/plan/itinerary` },
      { id: 'spots', label: 'スポット', path: `/trip/${trip.id}/plan/spots` },
      { id: 'budget', label: '予算', path: `/trip/${trip.id}/plan/budget` },
    ]
  }
  if (mode === 'memory') {
    // 共有はモードに属さない単発の操作なので TripLayout の外（/trip/:id/share）。
    // ここに載せると currentMode が 'plan' を返し、モードタブが PLAN に飛んでしまう。
    return [
      { id: 'memory', label: '旅行記', path: `/trip/${trip.id}/memory`, exact: true },
      { id: 'stats', label: '記録', path: `/trip/${trip.id}/memory/stats` },
    ]
  }
  return []
}

/** いま開いているセクション。パスの長い順に見て、部分一致の取りこぼしを防ぐ。 */
export function currentSection(pathname: string, sections: SectionState[]): string | undefined {
  const clean = pathname.replace(/\/$/, '')
  const exactHit = sections.find((s) => s.exact && clean === s.path.replace(/\/$/, ''))
  if (exactHit) return exactHit.id
  const prefixHit = [...sections]
    .filter((s) => !s.exact)
    .sort((a, b) => b.path.length - a.path.length)
    .find((s) => clean.startsWith(s.path))
  return prefixHit?.id
}
