/** "HH:MM" 形式の時刻と分数の相互変換、および日付ユーティリティ。 */

export function toMinutes(hhmm?: string): number | undefined {
  if (!hhmm) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 47 || min > 59) return undefined
  return h * 60 + min
}

export function toHHMM(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = Math.round(wrapped % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, delta: number): string {
  const base = toMinutes(hhmm)
  if (base === undefined) return hhmm
  return toHHMM(base + delta)
}

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

/** ISO date（YYYY-MM-DD）をローカル日付として Date に落とす。 */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysBetween(startISO: string, endISO: string): number {
  const ms = parseISODate(endISO).getTime() - parseISODate(startISO).getTime()
  return Math.round(ms / 86_400_000)
}

/** 開始日〜終了日の日付を連続配列で返す（両端を含む）。 */
export function dateRange(startISO: string, endISO: string): string[] {
  const span = Math.max(0, daysBetween(startISO, endISO))
  const start = parseISODate(startISO)
  return Array.from({ length: span + 1 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toISODate(d)
  })
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAY_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function weekdayJa(iso: string): string {
  return WEEKDAY_JA[parseISODate(iso).getDay()]
}

export function weekdayEn(iso: string): string {
  return WEEKDAY_EN[parseISODate(iso).getDay()]
}

/** "2027.05.01" 形式。Mono readout 用。 */
export function formatDateDot(iso: string): string {
  return iso.replaceAll('-', '.')
}

export function formatDateRange(startISO: string, endISO: string): string {
  const start = formatDateDot(startISO)
  const end = endISO.slice(5).replaceAll('-', '.')
  return `${start} — ${end}`
}

/** 今日を基準に出発までの日数。負なら出発済み。 */
export function daysUntil(iso: string, today = new Date()): number {
  return daysBetween(toISODate(today), iso)
}

export function nowHHMM(date = new Date()): string {
  return toHHMM(date.getHours() * 60 + date.getMinutes())
}
