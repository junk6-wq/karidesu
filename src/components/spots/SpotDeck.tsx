import { useCallback, useRef, useState } from 'react'
import type { Spot } from '@/types'
import { Photo } from '@/components/common/Photo'
import { formatDuration } from '@/lib/time'

/** これ以上動かしたら「決めた」とみなす距離（px）。 */
const SWIPE_THRESHOLD = 92
/** カードが飛んでいく時間。決定の手応えを出しつつ、待たされない長さ。 */
const FLY_MS = 260

type Decision = 'take' | 'skip'

/**
 * スポットを 1 枚ずつ見て、右へスワイプ（＝行く）／左へスワイプ（＝見送る）で
 * 旅の中身を積み上げていくデッキ。
 *
 * 一覧のチェックボックスだと「何を見て何を決めたか」が分からなくなるため、
 * 「今この 1 件を決める」ことだけに画面を使う。ボタンでも同じ操作ができるので、
 * スワイプを知らなくても詰まらない。
 */
export function SpotDeck({
  spots,
  onFinish,
  finishLabel = 'この内容で組み立てる',
  busy = false,
}: {
  spots: Spot[]
  onFinish: (taken: Spot[]) => void
  finishLabel?: string
  busy?: boolean
}) {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [flying, setFlying] = useState<Decision | null>(null)
  const startX = useRef<number | null>(null)

  const index = decisions.length
  const done = index >= spots.length
  const current = spots[index]
  const taken = spots.filter((_, i) => decisions[i] === 'take')

  const commit = useCallback((d: Decision) => {
    setFlying(d)
    setDragging(false)
    window.setTimeout(() => {
      setDecisions((prev) => [...prev, d])
      setFlying(null)
      setDx(0)
    }, FLY_MS)
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    if (flying || done) return
    startX.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    setDx(e.clientX - startX.current)
  }

  function onPointerUp() {
    if (startX.current === null) return
    startX.current = null
    setDragging(false)
    if (dx > SWIPE_THRESHOLD) commit('take')
    else if (dx < -SWIPE_THRESHOLD) commit('skip')
    else setDx(0)
  }

  function undo() {
    if (index === 0 || flying) return
    setDecisions((prev) => prev.slice(0, -1))
    setDx(0)
  }

  const offset = flying ? (flying === 'take' ? 560 : -560) : dx
  const intent: Decision | null = dx > 40 ? 'take' : dx < -40 ? 'skip' : null

  return (
    <div className="flex flex-1 flex-col">
      {/* 進み具合。あと何枚見ればいいかが常に分かるようにする */}
      <div className="flex items-center justify-between">
        <span className="mono-readout text-[12px] text-text-porcelain/50">
          {Math.min(index + 1, spots.length)} / {spots.length}
        </span>
        <span className="mono-readout text-[12px] text-brass">{taken.length} 件えらんだ</span>
      </div>
      <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full bg-brass transition-[width] duration-300 ease-passage"
          style={{ width: `${spots.length ? (index / spots.length) * 100 : 0}%` }}
        />
      </div>

      {/* カードの山 */}
      <div className="relative mt-5 flex-1" style={{ minHeight: 380 }}>
        {done ? (
          <DeckDone count={taken.length} onUndo={undo} canUndo={index > 0} />
        ) : (
          <>
            {/* 後ろに控えているカード。厚みを見せて「まだある」ことを伝える */}
            {[2, 1].map((back) => {
              const spot = spots[index + back]
              if (!spot) return null
              return (
                <div
                  key={spot.id}
                  className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                  style={{
                    transform: `translateY(${back * 10}px) scale(${1 - back * 0.04})`,
                    zIndex: 10 - back,
                  }}
                />
              )
            })}

            {current && (
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-x-0 top-0 z-20 h-full cursor-grab touch-none select-none overflow-hidden rounded-3xl border border-white/15 shadow-card active:cursor-grabbing"
                style={{
                  transform: `translateX(${offset}px) rotate(${offset / 24}deg)`,
                  transition: dragging ? 'none' : `transform ${FLY_MS}ms var(--e-passage)`,
                  opacity: flying ? 0 : 1,
                }}
              >
                <Photo
                  src={current.photoUrls[0]}
                  alt={current.name}
                  seed={current.name}
                  className="h-full w-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />

                  {/* 今どちらに倒しているかを、離す前に見せる */}
                  {intent && (
                    <span
                      className={`label-caps absolute top-6 rounded-full border-2 px-4 py-2 text-[14px] ${
                        intent === 'take'
                          ? 'left-6 -rotate-12 border-brass bg-brass/25 text-brass'
                          : 'right-6 rotate-12 border-white/60 bg-black/40 text-text-porcelain'
                      }`}
                    >
                      {intent === 'take' ? '行く' : '見送る'}
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <span className="label-caps rounded-full bg-black/40 px-2.5 py-1 text-text-porcelain/85">
                      {current.category}
                    </span>
                    <h2 className="font-display mt-3 text-[30px] leading-[1.1] text-text-porcelain">
                      {current.name}
                    </h2>
                    <p className="mono-readout mt-2 text-[12px] text-text-porcelain/65">
                      滞在 {formatDuration(current.estimatedStayMin ?? 60)}
                      {current.openingHours ? ` · ${current.openingHours}` : ''}
                    </p>
                  </div>
                </Photo>
              </div>
            )}
          </>
        )}
      </div>

      {/* 親指の届く位置に、スワイプと同じ操作をボタンでも置く */}
      {!done && (
        <div className="mt-5 flex items-center justify-center gap-4">
          <button
            onClick={() => commit('skip')}
            disabled={Boolean(flying)}
            aria-label="見送る"
            className="tap flex h-14 w-14 items-center justify-center rounded-full border border-white/25 text-[20px] text-text-porcelain/70 transition duration-200 ease-passage hover:border-white/50 disabled:opacity-40"
          >
            ✕
          </button>
          <button
            onClick={undo}
            disabled={index === 0 || Boolean(flying)}
            className="tap label-caps rounded-full px-3 text-[10px] text-text-porcelain/45 disabled:opacity-25"
          >
            1つ戻す
          </button>
          <button
            onClick={() => commit('take')}
            disabled={Boolean(flying)}
            aria-label="行く"
            className="tap flex h-14 w-14 items-center justify-center rounded-full bg-brass text-[20px] text-ink shadow-card transition duration-200 ease-passage hover:brightness-110 disabled:opacity-40"
          >
            ♥
          </button>
        </div>
      )}

      {/* 全部見なくても、決まった時点で先へ進める */}
      {taken.length > 0 && (
        <button
          onClick={() => onFinish(taken)}
          disabled={busy}
          className="tap mt-5 flex w-full items-center justify-center rounded-full bg-brass px-6 text-[15px] font-semibold text-ink shadow-card transition duration-200 ease-passage hover:brightness-110 disabled:opacity-50"
        >
          {busy ? '組み立てています…' : `${finishLabel}（${taken.length}件）`}
        </button>
      )}
    </div>
  )
}

function DeckDone({
  count,
  onUndo,
  canUndo,
}: {
  count: number
  onUndo: () => void
  canUndo: boolean
}) {
  return (
    <div className="anim-fade flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-8 text-center">
      <p className="font-display text-display-m text-text-porcelain">
        {count > 0 ? `${count} 件えらびました` : '全部見送りました'}
      </p>
      <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-text-porcelain/55">
        {count > 0
          ? '順番と時間はこのあと AI が組み立てます。あとから足すことも減らすこともできます。'
          : '1つも選ばれていません。戻ってもう一度見てみますか？'}
      </p>
      {canUndo && (
        <button
          onClick={onUndo}
          className="tap label-caps mt-6 rounded-full border border-white/25 px-4 text-text-porcelain/70"
        >
          1つ戻す
        </button>
      )}
    </div>
  )
}
