import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { ReplanSuggestion } from '@/types'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { buildContext, useJourneyStore } from '@/store/journeyStore'
import { NextCard } from '@/components/journey/NextCard'
import { TodayTimeline } from '@/components/journey/TodayTimeline'
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
 *
 * 「次の予定」を主役にしつつ、今日1日の予定は常時見える形で下に並べる
 * （以前は折りたたみの中に隠れていたため、次の予定しか見えないという問題があった）。
 * 片手操作を想定し、主要な操作（着いた/遅れそう/ルート）は画面下部に固定して
 * 親指の届く範囲に置く。ヘッダーと進捗（THE THREAD）はスクロールしても常に見える。
 */
export function JourneyScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { updateItem, updateTrip } = useTripsStore()
  const { states, manualDelay, startWatch, recompute, reportDelay, clearDelay } = useJourneyStore()

  const [suggestions, setSuggestions] = useState<ReplanSuggestion[]>([])
  const [replanOpen, setReplanOpen] = useState(false)
  const [replanLoading, setReplanLoading] = useState(false)
  const dismissedFor = useRef<string | null>(null)

  const journeyState = id
    ? (states[id] ?? { tripId: id, delayMinutes: 0, status: 'on_time' as const, lastUpdated: '' })
    : undefined

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

  const progress = ctx.todayItems.length ? ctx.doneCount / ctx.todayItems.length : 1
  const dayComplete = !ctx.nextItem

  return (
    <div className="relative min-h-dvh bg-ink text-text-porcelain">
      {/* 背景写真は雰囲気づけ程度に留め、読みやすさを優先して濃いオーバーレイをかける */}
      <Photo
        src={ctx.nextSpot?.photoUrls[0]}
        alt=""
        seed={trip.title}
        className="absolute inset-0 h-full w-full"
        imgClassName="scale-105 blur-[3px] opacity-70"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-ink/92 via-ink/90 to-ink" />
      </Photo>

      <div
        className={`relative flex min-h-dvh flex-col ${dayComplete ? 'pb-8' : 'pb-[calc(84px+env(safe-area-inset-bottom))]'}`}
      >
        {/* ヘッダー: スクロールしても常に見える */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-ink/70 px-5 py-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
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

        {/* 進捗: これも常時見える位置に固定気味に置く */}
        <div className="px-5 pt-4">
          <Thread variant="journey" progress={progress} status={status} showHead />
          <div className="mono-readout mt-2.5 flex items-center justify-between text-[11px] text-text-porcelain/45">
            <span>
              {ctx.doneCount} / {ctx.todayItems.length} DONE
            </span>
            <span
              className={
                status === 'delayed'
                  ? 'text-brick'
                  : status === 'at_risk'
                    ? 'text-[color:var(--c-amber)]'
                    : ''
              }
            >
              {delay > 0 ? `+${delay} MIN` : 'ON TIME'}
            </span>
          </div>
        </div>

        {/* NEXT: 画面の主役。1〜2秒で「次はどこ・何時・間に合うか」が分かる大きさにする */}
        <div className="px-5 pb-6 pt-6">
          <NextCard
            spot={ctx.nextSpot}
            plannedArrival={ctx.nextItem?.plannedArrival}
            etaMin={ctx.etaMin}
            distanceKm={ctx.distanceKm}
            leaveInMin={ctx.leaveInMin}
            status={status}
            delayMinutes={delay}
            onAdjust={openReplan}
          />
        </div>

        {/* 今日の予定: 常時展開。「次の予定しか見えない」を解消する本体 */}
        <div className="flex-1 px-5 pb-6">
          <div className="rounded-card border border-white/10 bg-white/[0.04] p-4">
            <p className="label-caps text-text-porcelain/45">今日の予定</p>
            {ctx.todayItems.length > 0 ? (
              <TodayTimeline
                items={ctx.todayItems}
                spots={trip.spots}
                nextItemId={ctx.nextItem?.id}
                className="mt-3"
              />
            ) : (
              <p className="mt-2 text-[13px] text-text-porcelain/50">今日の予定はありません。</p>
            )}
          </div>

          {dayComplete && ctx.todayItems.length > 0 && (
            <p className="mt-6 text-center text-[14px] text-text-porcelain/55">
              今日はここまで。ゆっくり休んでください。
            </p>
          )}
        </div>
      </div>

      {/* 操作バー: 親指の届く画面下部に固定 */}
      {!dayComplete && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink/85 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-[520px] items-center justify-center gap-2.5">
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
              ルート
            </Link>
          </div>
        </div>
      )}

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
