import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Spot } from '@/types'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { SpotGrid } from '@/components/spots/SpotGrid'
import { Thread } from '@/components/thread/Thread'
import { PACE_CAPACITY, aiAgent } from '@/lib/providers/mockAgent'
import { usePreferencesStore } from '@/store/preferencesStore'

/**
 * 既存の旅にスポットを足すときの選択画面。
 * ここは Trip 作成時と違い、すでに旅程がある中へピンポイントで数件足す場面なので、
 * SpotGrid（タップで選ぶ一覧）のままにしている。選び終わったら予定の少ない日へ
 * 自動で振り分け、続けて AI が時間と移動を整える。
 */
export function SpotPickScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const navigate = useNavigate()
  const { addSpotsAndArrange, runOptimize } = useTripsStore()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [candidates, setCandidates] = useState<Spot[]>([])

  useEffect(() => {
    if (!trip) return
    let alive = true
    const { travelStyle } = usePreferencesStore.getState().preferences
    void (async () => {
      const spots = await aiAgent.suggestSpots({
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        interests: travelStyle.interests,
        pace: travelStyle.pace,
        companions: trip.companions.length || travelStyle.defaultPartySize,
      })
      if (!alive) return
      // すでに旅程・候補に入っているものは出さない（名前で突き合わせる）
      const known = new Set(trip.spots.map((s) => s.name))
      setCandidates(spots.filter((s) => !known.has(s.name)))
      setLoading(false)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id])

  if (!trip || !id) return <Navigate to="/" replace />

  // すでに入っている件数を差し引いた「あと何件入れられるか」。
  // 目安を超えたら SpotGrid が選択中に知らせてくれる。
  const { travelStyle } = usePreferencesStore.getState().preferences
  const capacity = PACE_CAPACITY[travelStyle.pace] * Math.max(1, trip.itinerary.length)
  const currentCount = trip.itinerary.reduce((sum, d) => sum + d.items.length, 0)
  const headroom = capacity - currentCount

  async function adopt(picked: Spot[]) {
    setBusy(true)
    addSpotsAndArrange(id!, picked.map((s) => ({ ...s, source: 'ai' as const, aiRecommended: true })))
    await runOptimize(id!)
    navigate(`/trip/${id}/plan/itinerary`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink text-text-porcelain">
      <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/trip/${id}/plan/itinerary`)}
            className="tap label-caps -ml-2 rounded-full px-2 text-text-porcelain/60 hover:text-text-porcelain"
          >
            ← 旅程へ
          </button>
          <span className="mono-readout text-[12px] text-text-porcelain/50">{trip.destination}</span>
        </header>

        <div className="mt-4 text-text-porcelain/40">
          <Thread variant="plan" progress={0.5} showHead />
        </div>

        <main className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-display-l">行きたい場所を選ぶ</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-porcelain/55">
            タップして選ぶ。選んだ場所は空いている日に入れて、時間は AI が整えます。
          </p>

          {loading ? (
            <div className="mt-8 flex-1 animate-pulse rounded-3xl bg-white/5" />
          ) : candidates.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-white/10 p-5 text-[14px] leading-relaxed text-text-porcelain/55">
              新しく出せる候補がありません。「行きたい場所」から手で足すこともできます。
            </p>
          ) : (
            <div className="mt-6 flex flex-1 flex-col">
              <SpotGrid
                spots={candidates}
                recommended={headroom >= 1 ? headroom : undefined}
                onFinish={adopt}
                finishLabel="旅程に入れる"
                busy={busy}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
