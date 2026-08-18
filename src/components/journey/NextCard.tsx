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
 * 情報を増やさず減らす。見えるのは「次にどこへ、あと何分か」だけ。
 */
export function NextCard({
  spot,
  plannedArrival,
  etaMin,
  leaveInMin,
  status,
}: {
  spot?: Spot
  plannedArrival?: string
  etaMin?: number
  leaveInMin?: number
  status: JourneyStatus
}) {
  const color = STATUS_COLOR[status]

  return (
    <div className="anim-fade text-center">
      <p className="label-caps" style={{ color }}>
        NEXT
      </p>

      {/* 長い地名でも 2 行に収まるよう、文字数で段階的に落とす */}
      <h1
        className={`font-display mt-3 leading-[1.05] ${
          (spot?.name.length ?? 0) > 12
            ? 'text-display-m'
            : (spot?.name.length ?? 0) > 7
              ? 'text-display-l'
              : 'text-display-xl'
        }`}
      >
        {spot?.name ?? '今日の予定は以上です'}
      </h1>

      {spot && (
        <>
          <div className="mono-readout mt-6 flex items-center justify-center gap-5 text-[15px] text-text-porcelain/75">
            {plannedArrival && <span>⏱ {plannedArrival}</span>}
            {etaMin !== undefined && <span>{formatDuration(etaMin)}</span>}
          </div>

          <p className="mt-7 flex items-center justify-center gap-2 text-[15px]">
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
