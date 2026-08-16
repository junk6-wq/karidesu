import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Spot } from '@/types'
import { useTrip, useTripWarnings, useTripsStore } from '@/store/tripsStore'
import { Button } from '@/components/common/Button'
import { QuestChip } from '@/components/common/QuestChip'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { aiAgent } from '@/lib/providers/mockAgent'
import { addMinutes, formatDuration } from '@/lib/time'
import { formatCurrency } from '@/lib/format'
import { BUDGET_LABELS, BUDGET_ORDER, tripStats } from '@/lib/tripStats'
import { uid } from '@/lib/id'

type Bubble =
  | { id: string; kind: 'text'; body: string }
  | { id: string; kind: 'spots'; body: string; spots: Spot[] }
  | { id: string; kind: 'check'; body: string }
  | { id: string; kind: 'budget'; body: string; lines: string[] }

/** ユニオンを保ったまま id を落とす（そのまま Omit すると共通プロパティだけになる）。 */
type NewBubble = Bubble extends infer T ? (T extends Bubble ? Omit<T, 'id'> : never) : never

/**
 * S07 — AI Agent Panel
 * チャットではなく「提案カードの連なり」。
 * AI は質問に答える存在ではなく、旅程を一緒に組み立てる共作者として振る舞う。
 */
export function AgentPanelScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const warnings = useTripWarnings(id)
  const navigate = useNavigate()
  const { addSpot, addItem, runOptimize, agentBusy } = useTripsStore()

  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [busy, setBusy] = useState(false)
  const [taken, setTaken] = useState<Set<string>>(new Set())

  if (!trip || !id) return <Navigate to="/" replace />

  const stats = tripStats(trip)

  function push(b: NewBubble) {
    setBubbles((prev) => [...prev, { ...b, id: uid('b') } as Bubble])
  }

  async function proposeSpots() {
    setBusy(true)
    push({
      kind: 'text',
      body: `${trip!.destination}で、いまの旅程に入っていない場所を探します。`,
    })
    try {
      const spots = await aiAgent.suggestSpots({
        destination: trip!.destination,
        startDate: trip!.startDate,
        endDate: trip!.endDate,
        interests: [],
        pace: 'balanced',
        companions: trip!.companions.length,
      })
      const known = new Set(trip!.spots.map((s) => s.name))
      const fresh = spots.filter((s) => !known.has(s.name)).slice(0, 4)
      push({
        kind: 'spots',
        body: fresh.length
          ? `${fresh.length} 件あります。入れたいものを選んでください。`
          : '新しく提案できる場所は見つかりませんでした。',
        spots: fresh,
      })
    } finally {
      setBusy(false)
    }
  }

  async function checkItinerary() {
    setBusy(true)
    push({ kind: 'text', body: '移動時間・営業時間・1 日の詰め込み具合を見ます。' })
    try {
      await runOptimize(id!)
      push({ kind: 'check', body: '検証しました。' })
    } finally {
      setBusy(false)
    }
  }

  function reviewBudget() {
    const lines = BUDGET_ORDER.filter((c) => trip!.budget.planned[c] > 0).map((c) => {
      const share = stats.plannedTotal
        ? Math.round((trip!.budget.planned[c] / stats.plannedTotal) * 100)
        : 0
      return `${BUDGET_LABELS[c]} ${formatCurrency(trip!.budget.planned[c], trip!.budget.currency)}（${share}%）`
    })
    const perDay = stats.dayCount ? stats.plannedTotal / stats.dayCount : 0
    push({
      kind: 'budget',
      body:
        lines.length === 0
          ? 'まだ予算が入っていません。宿から入れると全体像が見えます。'
          : `1 日あたり ${formatCurrency(perDay, trip!.budget.currency)}。内訳はこうなっています。`,
      lines,
    })
  }

  /** 提案されたスポットを、いちばん予定の少ない日に差し込む。 */
  function takeSpot(spot: Spot) {
    const created = addSpot(id!, { ...spot, source: 'ai', aiRecommended: true })
    const target = [...trip!.itinerary].sort((a, b) => a.items.length - b.items.length)[0]
    if (target) {
      const last = target.items[target.items.length - 1]
      const base = last?.plannedDeparture ?? last?.plannedArrival ?? '09:30'
      const arrival = last ? addMinutes(base, 45) : base
      addItem(id!, target.id, {
        spotId: created.id,
        type: spot.category === '食事' ? 'meal' : 'sightseeing',
        plannedArrival: arrival,
        plannedDeparture: addMinutes(arrival, spot.estimatedStayMin ?? 60),
      })
    }
    setTaken((prev) => new Set(prev).add(spot.id))
    void runOptimize(id!)
  }

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-40 pt-6">
      <p className="label-caps text-text-ink/45">AI AGENT</p>
      <h1 className="font-display text-display-m mt-1">一緒に組み立てる</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-text-ink/55">
        質問に答えるのではなく、旅程そのものに手を入れます。提案はワンタップで反映されます。
      </p>

      <div className="mt-4 text-text-ink/20">
        <Thread variant="plan" progress={Math.min(1, bubbles.length / 4)} showHead />
      </div>

      {/* 開幕の提案 */}
      <AgentBubble>
        <p className="text-[14px] leading-relaxed">
          いまの旅程は <b>{stats.dayCount} 日</b>・<b>{stats.itemCount} 予定</b>、総移動は約{' '}
          <b>{Math.round(stats.distanceKm)} km</b> です。
          {warnings.length > 0
            ? ` 気になる点が ${warnings.length} 件あります。`
            : ' いまのところ大きな無理はありません。'}
        </p>
      </AgentBubble>

      {bubbles.map((b) => (
        <AgentBubble key={b.id}>
          <p className="text-[14px] leading-relaxed">{b.body}</p>

          {b.kind === 'spots' && (
            <ul className="mt-3 space-y-2">
              {b.spots.map((spot) => (
                <li key={spot.id}>
                  <button
                    disabled={taken.has(spot.id)}
                    onClick={() => takeSpot(spot)}
                    className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white p-2 text-left transition duration-200 ease-passage hover:border-brass disabled:opacity-45"
                  >
                    <Photo
                      src={spot.photoUrls[0]}
                      alt={spot.name}
                      className="h-12 w-16 shrink-0 rounded-lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{spot.name}</span>
                      <span className="mono-readout mt-0.5 block text-[11px] text-text-ink/45">
                        {spot.category} · {formatDuration(spot.estimatedStayMin ?? 60)}
                      </span>
                    </span>
                    <span className="mono-readout text-brass">
                      {taken.has(spot.id) ? '✓' : '＋'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {b.kind === 'check' && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {warnings.length === 0 ? (
                  <QuestChip severity="info">無理のある区間はありません</QuestChip>
                ) : (
                  warnings.map((w, i) => (
                    <QuestChip key={i} severity={w.severity}>
                      {w.message}
                    </QuestChip>
                  ))
                )}
              </div>
              <Button
                className="mt-3"
                onClick={() => navigate(`/trip/${id}/plan/itinerary`)}
              >
                旅程で直す
              </Button>
            </>
          )}

          {b.kind === 'budget' && b.lines.length > 0 && (
            <ul className="mono-readout mt-3 space-y-1 text-[12px] text-text-ink/60">
              {b.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </AgentBubble>
      ))}

      {(busy || agentBusy) && (
        <AgentBubble>
          <span className="mono-readout text-[12px] text-text-ink/45">考えています…</span>
        </AgentBubble>
      )}

      {/* 提案トリガー */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-stone via-stone/95 to-transparent px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex max-w-[720px] flex-wrap gap-2">
          <Button variant="primary" disabled={busy} onClick={proposeSpots}>
            行き先を提案して
          </Button>
          <Button disabled={busy} onClick={checkItinerary}>
            旅程を検証して
          </Button>
          <Button disabled={busy} onClick={reviewBudget}>
            予算を見て
          </Button>
        </div>
        <p className="mono-readout mx-auto mt-3 max-w-[720px] text-[10px] leading-relaxed text-text-ink/35">
          MVP のエージェントは固定ロジックで動いています（12章のアダプター経由で実 AI に差し替え可能）。
        </p>
      </div>
    </div>
  )
}

/** AI Agent Bubble（7章）— 会話ではなく提案カード。 */
function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="anim-rise mt-4 rounded-2xl border border-black/8 bg-white/75 p-4 shadow-[0_10px_30px_-24px_rgba(14,21,33,0.6)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        <span className="label-caps text-text-ink/40">AGENT</span>
      </div>
      {children}
    </div>
  )
}
