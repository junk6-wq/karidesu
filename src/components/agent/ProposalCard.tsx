import { useState } from 'react'
import type { AIProposal, Spot } from '@/types'
import { Button } from '@/components/common/Button'
import { formatDuration } from '@/lib/time'
import { formatCurrency, formatKm } from '@/lib/format'
import { computeItineraryDiff } from '@/lib/proposalDiff'

const LINE_STYLE: Record<string, string> = {
  same: 'text-text-ink/70',
  new: 'text-brass font-semibold',
  removed: 'text-brick/70 line-through',
  time_changed: 'text-[color:var(--c-amber)] font-semibold',
}

const LINE_MARK: Record<string, string> = {
  same: ' ',
  new: '+',
  removed: '−',
  time_changed: '±',
}

/**
 * AI 提案 1 件分のカード。
 * 結論（summary）→ 根拠（reason）→ 変更前/変更案の差分 → メリット/デメリット → 数値差分 → 操作、の3層構造。
 * 「この案を適用」を押すまで Store には一切書き込まない。
 */
export function ProposalCard({
  proposal,
  spots,
  currentItinerary,
  onApply,
  onNext,
  onDismiss,
  hasNext,
}: {
  proposal: AIProposal
  spots: Spot[]
  currentItinerary: Parameters<typeof computeItineraryDiff>[0]
  onApply: () => void
  onNext: () => void
  onDismiss: () => void
  hasNext: boolean
}) {
  const [showReason, setShowReason] = useState(false)
  // add_spot の変更は、承認して Store に反映されるまで trip.spots に存在しない新規スポットを含む。
  // 差分表示ではその場で名前を解決できるよう、提案内の新規スポットも合わせて渡す。
  const newSpots = proposal.changes.flatMap((c) => (c.kind === 'add_spot' ? [c.spot] : []))
  const diffSpots = newSpots.length ? [...spots, ...newSpots] : spots
  const diff = computeItineraryDiff(currentItinerary, proposal.previewItinerary, diffSpots)
  const canApply = proposal.changes.length > 0

  return (
    <div className="anim-rise rounded-2xl border border-black/8 bg-white/85 p-4 shadow-[0_10px_30px_-24px_rgba(14,21,33,0.6)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        <span className="label-caps text-text-ink/40">AI PROPOSAL</span>
        {proposal.confidence > 0 && (
          <span className="mono-readout ml-auto text-[10px] text-text-ink/35">
            確信度 {Math.round(proposal.confidence * 100)}%
          </span>
        )}
      </div>

      {/* 結論 */}
      <p className="text-[15px] font-semibold leading-relaxed text-text-ink">{proposal.summary}</p>

      {/* 根拠（折りたたみ） */}
      <button
        onClick={() => setShowReason((v) => !v)}
        className="tap mt-2 text-[12px] text-text-ink/45 underline decoration-dotted underline-offset-2"
      >
        {showReason ? '根拠を閉じる' : 'なぜこの提案？'}
      </button>
      {showReason && (
        <p className="anim-fade mt-2 rounded-xl bg-black/[0.03] p-3 text-[12px] leading-relaxed text-text-ink/65">
          {proposal.reason}
        </p>
      )}

      {/* 差分（変更前 / 変更案） */}
      {diff.length > 0 && (
        <div className="mt-3 space-y-3">
          {diff.map((section) => (
            <div key={section.dayId} className="rounded-xl border border-black/8 p-3">
              <p className="mono-readout text-[11px] text-brass">DAY {String(section.dayNumber).padStart(2, '0')}</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="label-caps text-text-ink/35">変更前</p>
                  <ul className="mt-1 space-y-0.5">
                    {section.before.map((line) => (
                      <li key={line.itemId} className={`mono-readout text-[11px] ${LINE_STYLE[line.status]}`}>
                        {LINE_MARK[line.status]} {line.time} {line.name}
                      </li>
                    ))}
                    {section.before.length === 0 && <li className="text-[11px] text-text-ink/30">—</li>}
                  </ul>
                </div>
                <div>
                  <p className="label-caps text-text-ink/35">変更案</p>
                  <ul className="mt-1 space-y-0.5">
                    {section.after.map((line) => (
                      <li key={line.itemId} className={`mono-readout text-[11px] ${LINE_STYLE[line.status]}`}>
                        {LINE_MARK[line.status]} {line.time} {line.name}
                      </li>
                    ))}
                    {section.after.length === 0 && <li className="text-[11px] text-text-ink/30">—</li>}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* メリット/デメリット */}
      {(proposal.benefits.length > 0 || proposal.drawbacks.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          {proposal.benefits.length > 0 && (
            <div>
              <p className="label-caps text-brass">メリット</p>
              <ul className="mt-1 space-y-0.5 text-text-ink/65">
                {proposal.benefits.map((b) => (
                  <li key={b}>・{b}</li>
                ))}
              </ul>
            </div>
          )}
          {proposal.drawbacks.length > 0 && (
            <div>
              <p className="label-caps text-text-ink/40">デメリット</p>
              <ul className="mt-1 space-y-0.5 text-text-ink/65">
                {proposal.drawbacks.map((d) => (
                  <li key={d}>・{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 推定差分 */}
      {(proposal.estimatedTimeDeltaMin !== undefined ||
        proposal.estimatedDistanceDeltaKm !== undefined ||
        proposal.estimatedBudgetDelta !== undefined) && (
        <div className="mono-readout mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-ink/50">
          {proposal.estimatedTimeDeltaMin !== undefined && (
            <span>
              時間 {proposal.estimatedTimeDeltaMin > 0 ? '+' : ''}
              {formatDuration(Math.abs(proposal.estimatedTimeDeltaMin))}
            </span>
          )}
          {proposal.estimatedDistanceDeltaKm !== undefined && (
            <span>
              距離 {proposal.estimatedDistanceDeltaKm > 0 ? '+' : '−'}
              {formatKm(Math.abs(proposal.estimatedDistanceDeltaKm))}
            </span>
          )}
          {proposal.estimatedBudgetDelta !== undefined && (
            <span>
              予算 {proposal.estimatedBudgetDelta > 0 ? '+' : '−'}
              {formatCurrency(Math.abs(proposal.estimatedBudgetDelta))}
            </span>
          )}
        </div>
      )}

      {/* 操作 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onApply} disabled={!canApply}>
          この案を適用
        </Button>
        {hasNext && <Button onClick={onNext}>別案</Button>}
        <Button variant="destructive" onClick={onDismiss}>
          却下
        </Button>
      </div>
    </div>
  )
}
