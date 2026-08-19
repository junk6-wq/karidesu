import type { WindowCostEstimate } from '@/types'
import { dateRange, daysBetween, parseISODate, toISODate } from '@/lib/time'

/**
 * 時期による費用の目安（モック）。
 * 実際の航空券・宿泊費 API には接続していない（静的サイトのため）。
 * 月ごとの繁忙度と、年末年始/GW/お盆のピーク期間、週末（金・土泊）を
 * 係数として重ねる、経験則ベースの推定値。UI 側では必ず「推定」と明示する。
 */

interface DestinationCostBase {
  transportPerPerson: number
  hotelPerPersonPerNight: number
}

const DESTINATION_COST_BASE: Record<string, DestinationCostBase> = {
  北海道: { transportPerPerson: 32000, hotelPerPersonPerNight: 9000 },
  沖縄: { transportPerPerson: 34000, hotelPerPersonPerNight: 10000 },
  京都: { transportPerPerson: 14000, hotelPerPersonPerNight: 8500 },
  長野: { transportPerPerson: 9000, hotelPerPersonPerNight: 7500 },
  東京: { transportPerPerson: 8000, hotelPerPersonPerNight: 11000 },
}

const DEFAULT_COST_BASE: DestinationCostBase = {
  transportPerPerson: 18000,
  hotelPerPersonPerNight: 8000,
}

function costBaseFor(destination: string): DestinationCostBase {
  return DESTINATION_COST_BASE[destination] ?? DEFAULT_COST_BASE
}

/** 月ごとの繁忙係数（1=平常）。桜・GW・夏休み・年末は高め、梅雨・2月は低め。 */
const MONTH_MULTIPLIER: Record<number, number> = {
  1: 1.1,
  2: 0.8,
  3: 0.95,
  4: 1.1,
  5: 1.15,
  6: 0.8,
  7: 1.05,
  8: 1.3,
  9: 0.85,
  10: 1.0,
  11: 0.9,
  12: 1.05,
}

interface PeakRange {
  label: string
  /** "MM-DD" */
  from: string
  to: string
  multiplier: number
}

/** 年をまたいで毎年適用するピーク期間。 */
const PEAK_RANGES: PeakRange[] = [
  { label: '年末年始', from: '12-28', to: '01-03', multiplier: 1.7 },
  { label: 'GW', from: '04-29', to: '05-05', multiplier: 1.5 },
  { label: 'お盆', from: '08-11', to: '08-16', multiplier: 1.45 },
]

function monthDayOf(iso: string): string {
  return iso.slice(5)
}

/** "MM-DD" が from〜to の範囲に入るか。年またぎ（12-28〜01-03）にも対応。 */
function inRange(md: string, from: string, to: string): boolean {
  if (from <= to) return md >= from && md <= to
  return md >= from || md <= to
}

function peakFor(iso: string): PeakRange | undefined {
  const md = monthDayOf(iso)
  return PEAK_RANGES.find((p) => inRange(md, p.from, p.to))
}

function seasonLabelAndMultiplier(iso: string): { label: string; multiplier: number } {
  const peak = peakFor(iso)
  if (peak) return { label: peak.label, multiplier: peak.multiplier }
  const month = parseISODate(iso).getMonth() + 1
  const multiplier = MONTH_MULTIPLIER[month] ?? 1
  const label = multiplier >= 1.1 ? '繁忙期' : multiplier <= 0.85 ? '閑散期' : '通常期'
  return { label, multiplier }
}

/** 金・土泊は宿泊費が上がりやすい。 */
function weekendMultiplier(iso: string): number {
  const day = parseISODate(iso).getDay() // 0=日 ... 5=金 6=土
  return day === 5 || day === 6 ? 1.15 : 1
}

/**
 * 開始日・泊数を固定した 1 案の概算費用。
 * 宿泊費は宿泊日ごとに季節・曜日係数を重ね、交通費は開始日の季節係数のみを使う
 * （複数月にまたがる旅行は稀という前提の簡易化）。
 */
export function estimateWindowCost(
  destination: string,
  startISO: string,
  nights: number,
  partySize: number,
): WindowCostEstimate {
  const base = costBaseFor(destination)
  const endISO = toISODate(
    (() => {
      const d = parseISODate(startISO)
      d.setDate(d.getDate() + nights)
      return d
    })(),
  )
  const stayNights = dateRange(startISO, endISO).slice(0, nights)
  const hotelTotal = stayNights.reduce((sum, night) => {
    const { multiplier } = seasonLabelAndMultiplier(night)
    return sum + base.hotelPerPersonPerNight * partySize * multiplier * weekendMultiplier(night)
  }, 0)
  const { label, multiplier: transportMultiplier } = seasonLabelAndMultiplier(startISO)
  const transportTotal = base.transportPerPerson * partySize * transportMultiplier
  const total = Math.round(hotelTotal + transportTotal)
  return {
    startDate: startISO,
    endDate: endISO,
    nights,
    total,
    perNightAverage: nights > 0 ? Math.round(total / nights) : total,
    seasonLabel: label,
    isCheapest: false,
  }
}

/**
 * 休暇期間（earliestStart〜latestEnd）の中で、指定泊数の旅を何日始まりにすると
 * 得かを比較する。期間が長いほど候補を間引いて計算量を抑える。
 */
export function suggestBestWindows(input: {
  destination: string
  earliestStart: string
  latestEnd: string
  nights: number
  partySize: number
}): WindowCostEstimate[] {
  const { destination, earliestStart, latestEnd, nights, partySize } = input
  const lastPossibleStart = (() => {
    const d = parseISODate(latestEnd)
    d.setDate(d.getDate() - nights)
    return toISODate(d)
  })()
  if (lastPossibleStart < earliestStart || nights <= 0) return []

  const span = daysBetween(earliestStart, lastPossibleStart) + 1
  const step = span > 40 ? 3 : span > 16 ? 2 : 1
  const starts = dateRange(earliestStart, lastPossibleStart).filter((_, i) => i % step === 0)
  // 最終候補が間引きで抜け落ちないように、末尾は必ず含める
  if (starts[starts.length - 1] !== lastPossibleStart) starts.push(lastPossibleStart)

  const estimates = starts.map((s) => estimateWindowCost(destination, s, nights, partySize))
  const cheapestTotal = Math.min(...estimates.map((e) => e.total))
  // 同額タイが多いと「最安」だらけになり比較にならないため、最も早い1件だけに印を付ける
  let markedCheapest = false
  return estimates
    .map((e) => {
      const isCheapest = !markedCheapest && e.total === cheapestTotal
      if (isCheapest) markedCheapest = true
      return { ...e, isCheapest }
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}
