import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { Button } from '@/components/common/Button'
import { StatReadout } from '@/components/common/StatReadout'
import { Thread } from '@/components/thread/Thread'
import { formatCurrency, formatKm } from '@/lib/format'
import { formatDateRange } from '@/lib/time'
import { effectiveSpend, tripStats } from '@/lib/tripStats'

/**
 * S13 — Share / Export
 * 共有はテキスト or Web Share API、PDF はブラウザの印刷ダイアログ経由。
 * 旅そのもののデータは JSON で持ち出せる（将来のクラウド同期までの避難路）。
 */
export function ShareScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const [note, setNote] = useState<string | null>(null)

  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const spend = effectiveSpend(trip)

  const shareText = [
    `${trip.title} — ${formatDateRange(trip.startDate, trip.endDate)}`,
    '',
    trip.memory?.narrative ?? `${trip.destination}を${stats.dayCount}日間。`,
    '',
    `${stats.itemCount} spots / ${formatKm(stats.distanceKm)} / ${formatCurrency(spend, trip.budget.currency)}`,
    '— PASSAGE',
  ].join('\n')

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

  return (
    <div className="mx-auto max-w-[720px] px-6 pb-28 pt-8">
      <Link
        to={`/trip/${trip.id}/memory`}
        className="tap label-caps no-print -ml-2 inline-flex items-center rounded-full px-2 text-text-porcelain/55"
      >
        ← TRAVELOGUE
      </Link>

      <h1 className="font-display text-display-l mt-5">この旅を渡す</h1>

      {/* 共有カードのプレビュー = 印刷対象 */}
      <div className="print-sheet mt-8 rounded-card border border-white/12 bg-white/[0.04] p-6">
        <p className="mono-readout text-[11px] text-brass">PASSAGE</p>
        <h2 className="font-display text-display-m mt-2">{trip.title}</h2>
        <p className="mono-readout mt-1 text-[12px] text-text-porcelain/55">
          {formatDateRange(trip.startDate, trip.endDate)} · {trip.destination}
        </p>

        <div className="my-5">
          <Thread variant="memory" progress={1} showHead={false} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatReadout label="DAYS" value={stats.dayCount} tone="dark" size="s" />
          <StatReadout label="DISTANCE" value={formatKm(stats.distanceKm)} tone="dark" size="s" />
          <StatReadout
            label="SPENT"
            value={formatCurrency(spend, trip.budget.currency)}
            tone="dark"
            size="s"
          />
        </div>

        {trip.memory?.narrative && (
          <p className="mt-6 whitespace-pre-line text-[13px] leading-[1.95] text-text-porcelain/75">
            {trip.memory.narrative}
          </p>
        )}
      </div>

      <div className="no-print mt-8 flex flex-wrap gap-3">
        <Button variant="primary" onClick={share}>
          共有する
        </Button>
        <Button tone="dark" onClick={copy}>
          テキストをコピー
        </Button>
        <Button tone="dark" onClick={() => window.print()}>
          PDF に書き出す
        </Button>
        <Button tone="dark" onClick={exportJson}>
          データを保存（JSON）
        </Button>
      </div>

      {note && (
        <p className="mono-readout no-print mt-4 text-[12px] text-brass">{note}</p>
      )}

      <p className="mono-readout no-print mt-10 text-[11px] leading-relaxed text-text-porcelain/30">
        PDF はブラウザの印刷ダイアログから「PDF に保存」を選んでください。
        共有リンクの発行は、データをクラウドに置いたあとの機能になります（14章）。
      </p>
    </div>
  )
}
