import type { JourneyStatus, Spot } from '@/types'
import { formatDuration } from '@/lib/time'

const STATUS_TEXT: Record<JourneyStatus, string> = {
  on_time: '順調です',
  at_risk: '少し押しています',
  delayed: '遅れています',
}

const STATUS_COLOR: Record<JourneyStatus, string> = {
  on_time: 'var(--c-brass-gold)',
  at_risk: 'var(--c-amber)',
  delayed: 'var(--c-brick-coral)',
}

/**
 * Next Card（S08 の中心コンポーネント）。
 * 「次にどこへ、あと何分か」を最優先で見せる。
 * compact は、今日の予定タイムラインと同じ画面に収めるための小さめサイズ。
 */
export function NextCard({
  spot,
  plannedArrival,
  etaMin,
  leaveInMin,
  status,
  compact = false,
}: {
  spot?: Spot
  plannedArrival?: string
  etaMin?: number
  leaveInMin?: number
  status: JourneyStatus
  compact?: boolean
}) {
  const color = STATUS_COLOR[status]
  const nameLen = spot?.name.length ?? 0

  const titleSize = compact
    ? nameLen > 12
      ? 'text-[22px]'
      : nameLen > 7
        ? 'text-[27px]'
        : 'text-display-m'
    : nameLen > 12
      ? 'text-display-m'
      : nameLen > 7
        ? 'text-display-l'
        : 'text-display-xl'

  return (
    <div className="anim-fade text-center">
      <p className="label-caps" style={{ color }}>
        NEXT
      </p>

      {/* 長い地名でも 2 行に収まるよう、文字数で段階的に落とす */}
      <h1 className={`font-display leading-[1.08] ${compact ? 'mt-2' : 'mt-3'} ${titleSize}`}>
        {spot?.name ?? '今日の予定は以上です'}
      </h1>

      {spot && (
        <>
          <div
            className={`mono-readout flex items-center justify-center text-[14px] text-text-porcelain/75 ${
              compact ? 'mt-3 gap-4' : 'mt-6 gap-5'
            }`}
          >
            {plannedArrival && <span>⏱ {plannedArrival}</span>}
            {etaMin !== undefined && <span>{formatDuration(etaMin)}</span>}
          </div>

          <p
            className={`flex items-center justify-center gap-2 text-[14px] ${compact ? 'mt-3' : 'mt-7'}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            />
            <span style={{ color }}>
              {leaveInMin === undefined
                ? STATUS_TEXT[status]
                : leaveInMin > 0
                  ? `あと ${formatDuration(leaveInMin)} で出発`
                  : `${formatDuration(-leaveInMin)} 出発が遅れています`}
            </span>
          </p>
        </>
      )}
    </div>
  )
}
