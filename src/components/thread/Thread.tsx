import { useEffect, useState } from 'react'
import type { JourneyStatus } from '@/types'

export type ThreadVariant = 'plan' | 'journey' | 'memory' | 'locked'

const STATUS_COLOR: Record<JourneyStatus, string> = {
  on_time: 'var(--c-brass-gold)',
  at_risk: 'var(--c-amber)',
  delayed: 'var(--c-brick-coral)',
}

export interface ThreadProps {
  variant: ThreadVariant
  /** 0–1。塗りつぶし済みの割合 */
  progress?: number
  /** JOURNEY 時のみ。糸の色相をわずかに変える */
  status?: JourneyStatus
  /** 進行中の脈動を出す（Home の進行中カードなど） */
  pulse?: boolean
  className?: string
  /** 線の太さ */
  weight?: number
  /** 進捗の先端に光点を置く */
  showHead?: boolean
}

/** 未到達区間の描き方。点線は CSS グラデーションで作る。 */
function trackBackground(variant: ThreadVariant): string {
  switch (variant) {
    case 'plan':
      // まだ確定していない糸
      return 'repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 8px)'
    case 'locked':
      // 途切れた糸
      return 'repeating-linear-gradient(90deg, currentColor 0 10px, transparent 10px 22px)'
    default:
      return 'currentColor'
  }
}

/**
 * THE THREAD — PLAN / JOURNEY / MEMORY を貫く唯一のビジュアルモチーフ。
 *
 *  plan   : 点線。まだ確定していない糸。
 *  journey: 実線 + 金色の光点。進むごとに塗りつぶされる。
 *  memory : 完成した金の軌跡線。
 *  locked : 途切れた糸。まだ解禁されていないモードを示す。
 *
 * 塗りは幅のトランジションで表現する（SVG の pathLength は
 * Chrome の <line> で効かず、進捗が描けないため使わない）。
 */
export function Thread({
  variant,
  progress = 0,
  status = 'on_time',
  pulse = false,
  className = '',
  weight = 2,
  showHead = variant === 'journey',
}: ThreadProps) {
  const clamped = Math.min(1, Math.max(0, progress))
  const color = variant === 'journey' ? STATUS_COLOR[status] : 'var(--c-brass-gold)'
  const filled = variant !== 'locked' && clamped > 0

  return (
    <span
      className={`relative block w-full ${className}`}
      style={{ height: Math.max(weight * 2, 6) }}
      aria-hidden="true"
    >
      {/* 未確定・未到達部分 */}
      <span
        className="absolute inset-x-0 top-1/2 block -translate-y-1/2 rounded-full"
        style={{
          height: weight,
          background: trackBackground(variant),
          opacity: variant === 'locked' ? 0.3 : 0.22,
        }}
      />

      {/* 到達済み部分 */}
      {filled && (
        <span
          className="absolute left-0 top-1/2 block -translate-y-1/2 rounded-full"
          style={{
            height: weight,
            width: `${clamped * 100}%`,
            // color は CSS 変数なので、透明度は color-mix で作る（"var(...)8c" は無効）
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
            transition: 'width var(--d-slow) var(--e-passage)',
            animation: pulse ? 'thread-pulse 2.6s ease-in-out infinite' : undefined,
          }}
        />
      )}

      {/* 現在地の光点 */}
      {showHead && variant !== 'locked' && (
        <span
          className="absolute top-1/2 block rounded-full"
          style={{
            left: `${clamped * 100}%`,
            height: weight * 3.2,
            width: weight * 3.2,
            transform: 'translate(-50%, -50%)',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            transition: 'left var(--d-slow) var(--e-passage)',
          }}
        />
      )}
    </span>
  )
}

/**
 * 縦方向の THE THREAD。Timeline のノード間を繋ぐ。
 * 到達済みノードまでを金で塗り、未確定区間は点線で描く。
 */
export function ThreadSegment({
  variant,
  reached,
  className = '',
}: {
  variant: ThreadVariant
  reached: boolean
  className?: string
}) {
  return (
    <span
      className={`block w-px flex-1 ${className}`}
      style={{
        background: reached
          ? 'var(--c-brass-gold)'
          : variant === 'plan'
            ? 'repeating-linear-gradient(180deg, currentColor 0 3px, transparent 3px 8px)'
            : 'currentColor',
        opacity: reached ? 1 : 0.28,
        transition: 'opacity var(--d-base) var(--e-passage)',
      }}
      aria-hidden="true"
    />
  )
}

/**
 * 旅の解禁アニメーション用。マウント時に線が一度だけ描かれる。
 * MEMORY のアンロック演出（Thread が金色で完成する）に使う。
 */
export function ThreadDraw({ className = '' }: { className?: string }) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <span
      className={`block h-0.5 w-full overflow-hidden rounded-full ${className}`}
      aria-hidden="true"
    >
      <span
        className="block h-full w-full rounded-full bg-brass"
        style={{
          transformOrigin: 'left center',
          transform: `scaleX(${drawn ? 1 : 0})`,
          transition: 'transform 1.4s var(--e-passage)',
        }}
      />
    </span>
  )
}
