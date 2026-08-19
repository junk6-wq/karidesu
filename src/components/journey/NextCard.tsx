import type { JourneyStatus, Spot } from '@/types'
import { addMinutes, formatDuration, nowHHMM } from '@/lib/time'
import { formatKm } from '@/lib/format'

const STATUS_COLOR: Record<JourneyStatus, string> = {
  on_time: 'var(--c-brass-gold)',
  at_risk: 'var(--c-amber)',
  delayed: 'var(--c-brick-coral)',
}

const STATUS_BG: Record<JourneyStatus, string> = {
  on_time: 'bg-brass/12 border-brass/30',
  at_risk: 'bg-[color:var(--c-amber)]/12 border-[color:var(--c-amber)]/35',
  delayed: 'bg-brick/12 border-brick/35',
}

/**
 * Next Card — JOURNEY 画面の主役。
 * 「今どこ？次はどこ？何時？間に合う？」に 1〜2 秒で答えることを最優先にする（29章）。
 * WHAT（行き先）→ WHEN（到着予定）→ WHERE（現在地からの距離・移動手段）→
 * ACTION（間に合うか・調整するか）の順で視線が流れるよう縦に積む。
 */
export function NextCard({
  spot,
  plannedArrival,
  etaMin,
  distanceKm,
  leaveInMin,
  status,
  delayMinutes,
  onAdjust,
}: {
  spot?: Spot
  plannedArrival?: string
  etaMin?: number
  distanceKm?: number
  leaveInMin?: number
  status: JourneyStatus
  delayMinutes: number
  onAdjust?: () => void
}) {
  const color = STATUS_COLOR[status]
  const nameLen = spot?.name.length ?? 0
  const titleSize = nameLen > 12 ? 'text-[26px]' : nameLen > 7 ? 'text-display-m' : 'text-display-l'
  const estimatedArrival = etaMin !== undefined ? addMinutes(nowHHMM(), etaMin) : undefined
  const isLate = status !== 'on_time'

  if (!spot) {
    return (
      <div className="anim-fade rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <p className="label-caps text-text-porcelain/40">NEXT</p>
        <p className="font-display text-display-m mt-2">今日の予定は以上です</p>
      </div>
    )
  }

  return (
    <div className="anim-fade overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05]">
      <div className="p-5 pb-4 text-center">
        <p className="label-caps" style={{ color }}>
          NEXT
        </p>
        <h1 className={`font-display leading-[1.08] ${titleSize} mt-1.5`}>{spot.name}</h1>

        {/* WHERE: 現在地からの距離・移動手段 */}
        {(etaMin !== undefined || distanceKm !== undefined) && (
          <p className="mono-readout mt-2 text-[12px] text-text-porcelain/50">
            現在地 → 目的地
            {distanceKm !== undefined && <span className="ml-2">{formatKm(distanceKm)}</span>}
          </p>
        )}

        {/* WHEN: 到着予定を最大の数字で見せる */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <div>
            <p className="label-caps text-text-porcelain/35">到着予定</p>
            <p className="mono-readout mt-1 text-[32px] leading-none text-text-porcelain">
              {plannedArrival ?? '--:--'}
            </p>
          </div>
          {etaMin !== undefined && (
            <div>
              <p className="label-caps text-text-porcelain/35">🚗 移動</p>
              <p className="mono-readout mt-1 text-[32px] leading-none" style={{ color }}>
                {formatDuration(etaMin)}
              </p>
            </div>
          )}
        </div>

        {/* 予定 vs 現在の見込み。旅程と現在地を1つの数字比較で融合させる */}
        {estimatedArrival && estimatedArrival !== plannedArrival && (
          <p className="mono-readout mt-2 text-[11px] text-text-porcelain/40">
            今から向かうと見込み <span style={{ color }}>{estimatedArrival}</span> 到着
          </p>
        )}
      </div>

      {/* ACTION: 間に合うかどうかの結論を、色付きバナーで最初に見せる */}
      <div className={`border-t px-5 py-3.5 ${STATUS_BG[status]}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color }}>
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: color, boxShadow: `0 0 10px ${color}` }}
            />
            {isLate
              ? `⚠️ ${delayMinutes}分遅れ`
              : leaveInMin !== undefined && leaveInMin > 0
                ? `あと${formatDuration(leaveInMin)}で出発`
                : '順調です'}
          </p>
          {isLate && onAdjust && (
            <button
              onClick={onAdjust}
              className="tap label-caps shrink-0 rounded-full bg-ink/40 px-3.5 text-[11px]"
              style={{ color }}
            >
              調整する →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
