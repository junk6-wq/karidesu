import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { ReplanSuggestion } from '@/types'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { buildContext, useJourneyStore } from '@/store/journeyStore'
import { NextCard } from '@/components/journey/NextCard'
import { ReplanSheet } from '@/components/journey/ReplanSheet'
import { Thread } from '@/components/thread/Thread'
import { Button } from '@/components/common/Button'
import { Photo } from '@/components/common/Photo'
import { aiAgent } from '@/lib/providers/mockAgent'
import { applyReplan } from './applyReplan'
import { nowHHMM } from '@/lib/time'

const POLL_MS = 30_000

/**
 * S08 — Journey / Next
 * 旅行中のメイン画面。他の予定は畳み、いま必要な 1 つだけを見せる。
 */
export function JourneyScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { updateItem, updateTrip } = useTripsStore()
  const { states, manualDelay, startWatch, recompute, reportDelay, clearDelay } = useJourneyStore()

  const [suggestions, setSuggestions] = useState<ReplanSuggestion[]>([])
  const [replanOpen, setReplanOpen] = useState(false)
  const [replanLoading, setReplanLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const dismissedFor = useRef<string | null>(null)

  const journeyState = id ? (states[id] ?? { tripId: id, delayMinutes: 0, status: 'on_time' as const, lastUpdated: '' }) : undefined

  // 位置情報の購読と 30 秒ごとの再判定
  useEffect(() => {
    if (!id || !trip) return
    const stopWatch = startWatch(id)
    recompute(id, trip)
    const timer = window.setInterval(() => recompute(id, trip), POLL_MS)
    return () => {
      stopWatch()
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, trip?.id])

  const ctx = useMemo(
    () =>
      trip && journeyState
        ? buildContext(trip, journeyState, id ? (manualDelay[id] ?? 0) : 0)
        : undefined,
    [trip, journeyState, manualDelay, id],
  )

  const status = ctx?.state.status ?? 'on_time'
  const delay = ctx?.state.delayMinutes ?? 0

  const openReplan = useCallback(async () => {
    if (!trip || !ctx) return
    setReplanOpen(true)
    setReplanLoading(true)
    try {
      setSuggestions(await aiAgent.detectDelay(ctx.state, trip))
    } finally {
      setReplanLoading(false)
    }
  }, [trip, ctx])

  // 遅延を検知したら、一度だけそっと降ろす
  useEffect(() => {
    if (!ctx || status === 'on_time') return
    const key = `${ctx.nextItem?.id ?? 'none'}:${status}`
    if (dismissedFor.current === key) return
    dismissedFor.current = key
    void openReplan()
  }, [status, ctx, openReplan])

  if (!trip || !id || !ctx) return <Navigate to="/" replace />

  function markArrived() {
    if (!ctx?.nextItem) return
    updateItem(id!, ctx.nextItem.id, { actualArrival: nowHHMM() })
    clearDelay(id!)
    dismissedFor.current = null
  }

  function adopt(s: ReplanSuggestion) {
    updateTrip(id!, { itinerary: applyReplan(trip!, s) })
    clearDelay(id!)
    setReplanOpen(false)
  }

  const progress = ctx.todayItems.length
    ? ctx.doneCount / ctx.todayItems.length
    : 1

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-text-porcelain">
      {/* 背景は次の目的地の風景。取得できないときは海図のグラデーションに落ちる */}
      <Photo
        src={ctx.nextSpot?.photoUrls[0]}
        alt=""
        seed={trip.title}
        className="absolute inset-0 h-full w-full"
        imgClassName="scale-105 blur-[2px]"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/80 to-ink" />
      </Photo>

      <div className="relative flex min-h-dvh flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <Link
            to={`/trip/${trip.id}`}
            className="tap label-caps -ml-2 flex items-center rounded-full px-2 text-text-porcelain/55"
          >
            ← PLAN
          </Link>
          <span className="mono-readout text-[11px] text-text-porcelain/45">
            DAY {ctx.doneCount + (ctx.nextItem ? 1 : 0)} / {ctx.todayItems.length} · {nowHHMM()}
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <NextCard
            spot={ctx.nextSpot}
            plannedArrival={ctx.nextItem?.plannedArrival}
            etaMin={ctx.etaMin}
            leaveInMin={ctx.leaveInMin}
            status={status}
          />

          {ctx.nextItem && (
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              <Button variant="primary" onClick={markArrived}>
                着いた
              </Button>
              <Button tone="dark" onClick={() => reportDelay(id!, 15)}>
                遅れそう
              </Button>
              <Link
                to={`/trip/${trip.id}/journey/route`}
                className="tap inline-flex items-center justify-center rounded-full border border-white/25 px-5 text-[14px] font-semibold text-text-porcelain/90 hover:bg-white/10"
              >
                ルートを見る
              </Link>
            </div>
          )}

          {!ctx.nextItem && (
            <p className="mt-8 text-center text-[14px] text-text-porcelain/55">
              今日はここまで。ゆっくり休んでください。
            </p>
          )}
        </div>

        {/* THE THREAD — 常時表示。現在地から次の目的地までを金色で塗る */}
        <div className="pb-2 text-text-porcelain">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="tap w-full text-left"
            aria-expanded={expanded}
          >
            <Thread variant="journey" progress={progress} status={status} showHead />
            <div className="mono-readout mt-3 flex items-center justify-between text-[11px] text-text-porcelain/45">
              <span>
                {ctx.doneCount} / {ctx.todayItems.length} DONE
              </span>
              <span>
                {delay > 0 ? `+${delay} MIN` : 'ON TIME'} · {expanded ? '閉じる' : '今日の予定'}
              </span>
            </div>
          </button>

          {expanded && (
            <ul className="anim-fade mt-4 space-y-1.5">
              {ctx.todayItems.map((item) => {
                const spot = trip.spots.find((s) => s.id === item.spotId)
                const done = Boolean(item.actualArrival)
                const isNext = item.id === ctx.nextItem?.id
                return (
                  <li
                    key={item.id}
                    className={`mono-readout flex items-center gap-3 text-[12px] ${
                      done
                        ? 'text-text-porcelain/35 line-through'
                        : isNext
                          ? 'text-brass'
                          : 'text-text-porcelain/70'
                    }`}
                  >
                    <span className="w-10 shrink-0">{item.plannedArrival ?? '--:--'}</span>
                    <span className="truncate">{spot?.name ?? '—'}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ReplanSheet
        open={replanOpen}
        loading={replanLoading}
        headline={
          ctx.nextSpot
            ? `このままだと ${ctx.nextSpot.name} に ${Math.max(1, delay)} 分ほど遅れます`
            : '予定より遅れています'
        }
        suggestions={suggestions}
        onAdopt={adopt}
        onDismiss={() => setReplanOpen(false)}
      />
    </div>
  )
}
