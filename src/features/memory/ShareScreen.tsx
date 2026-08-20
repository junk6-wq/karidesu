import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { Button } from '@/components/common/Button'
import { StatReadout } from '@/components/common/StatReadout'
import { Thread } from '@/components/thread/Thread'
import { formatCurrency, formatKm } from '@/lib/format'
import { formatDateDot, formatDateRange, weekdayEn } from '@/lib/time'
import { effectiveSpend, tripStats } from '@/lib/tripStats'
import { buildShareText } from '@/lib/shareText'

/**
 * S13 — Share / Export
 * 共有はテキスト or Web Share API、PDF はブラウザの印刷ダイアログ経由。
 * 旅そのもののデータは JSON で持ち出せる（将来のクラウド同期までの避難路）。
 *
 * 旅の前でも渡せるよう、モードタブの外（/trip/:id/share）に置いた単独画面。
 * 印刷して渡すことも想定して、紙に近い明るい面で組む。
 */
export function ShareScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const [note, setNote] = useState<string | null>(null)

  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const spend = effectiveSpend(trip)
  const spotById = new Map(trip.spots.map((s) => [s.id, s]))
  const shareText = buildShareText(trip)

  function flash(message: string) {
    setNote(message)
    window.setTimeout(() => setNote(null), 2400)
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: trip!.title, text: shareText })
        return
      } catch {
        // ユーザーがキャンセルした場合はコピーにフォールバックしない
        return
      }
    }
    await copy()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText)
      flash('コピーしました')
    } catch {
      flash('コピーできませんでした')
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip!.title.toLowerCase()}-passage.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const subText = 'text-text-ink/55'
  const bodyText = 'text-text-ink/70'

  return (
    <div className="min-h-dvh bg-stone text-text-ink">
      <div className="mx-auto max-w-[720px] px-6 pb-28 pt-[max(20px,env(safe-area-inset-top))]">
        <Link
          to={`/trip/${trip.id}`}
          className="tap label-caps no-print -ml-2 inline-flex items-center rounded-full px-2 text-text-ink/55"
        >
          ← {trip.title}
        </Link>

        <h1 className="font-display text-display-l mt-4">この旅を渡す</h1>
        <p className={`mt-2 text-[13px] leading-relaxed ${subText}`}>
          受け取った人がその場で全体を掴めるよう、日ごとの行程を入れて渡します。
        </p>

        {/* 共有カードのプレビュー = 印刷対象 */}
        <div className="print-sheet mt-7 rounded-card border border-black/10 bg-white/70 p-6">
        <p className="mono-readout text-[11px] text-brass">PASSAGE</p>
        <h2 className="font-display text-display-m mt-2">{trip.title}</h2>
        <p className={`mono-readout mt-1 text-[12px] ${subText}`}>
          {formatDateRange(trip.startDate, trip.endDate)} · {trip.destination}
        </p>

        <div className="my-5">
          <Thread variant="memory" progress={1} showHead={false} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatReadout label="DAYS" value={stats.dayCount} tone="light" size="s" />
          <StatReadout
            label="DISTANCE"
            value={formatKm(stats.distanceKm)}
            tone="light"
            size="s"
          />
          <StatReadout
            label={trip.memory ? 'SPENT' : 'BUDGET'}
            value={formatCurrency(spend, trip.budget.currency)}
            tone="light"
            size="s"
          />
        </div>

        {/* 全行程。共有の主目的なので要約より前に置く */}
        <div className={`mt-6 space-y-4 border-t pt-5 border-black/8`}>
          {trip.itinerary.map((day, i) => (
            <div key={day.id}>
              <p className="mono-readout text-[11px] text-brass">
                DAY {String(i + 1).padStart(2, '0')}
                <span className={`ml-2 ${subText}`}>
                  {formatDateDot(day.date)} {weekdayEn(day.date)}
                </span>
              </p>
              {day.items.length === 0 ? (
                <p className={`mt-1 text-[12px] ${subText}`}>予定なし</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {day.items.map((item) => (
                    <li key={item.id} className={`flex gap-3 text-[13px] ${bodyText}`}>
                      <span className="mono-readout shrink-0 text-[11px] opacity-70">
                        {item.plannedArrival ?? '--:--'}
                      </span>
                      <span className="min-w-0 flex-1">
                        {spotById.get(item.spotId)?.name ?? '予定'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {trip.memory?.narrative && (
          <p className={`mt-6 whitespace-pre-line text-[13px] leading-[1.95] ${bodyText}`}>
            {trip.memory.narrative}
          </p>
        )}
      </div>

        <div className="no-print mt-8 flex flex-wrap gap-3">
          <Button variant="primary" onClick={share}>
            共有する
          </Button>
        <Button tone="light" onClick={copy}>
          テキストをコピー
        </Button>
        <Button tone="light" onClick={() => window.print()}>
          PDF に書き出す
        </Button>
        <Button tone="light" onClick={exportJson}>
          データを保存（JSON）
        </Button>
      </div>

        {note && <p className="mono-readout no-print mt-4 text-[12px] text-brass">{note}</p>}

        <p className="mono-readout no-print mt-10 text-[11px] leading-relaxed text-text-ink/35">
          PDF はブラウザの印刷ダイアログから「PDF に保存」を選んでください。
          共有リンクの発行は、データをクラウドに置いたあとの機能になります（14章）。
        </p>
      </div>
    </div>
  )
}
