import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { AIProposal, Spot } from '@/types'
import { useTrip, useTripWarnings, useTripsStore } from '@/store/tripsStore'
import { Button } from '@/components/common/Button'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { ProposalCard } from '@/components/agent/ProposalCard'
import { TripCheck } from '@/components/agent/TripCheck'
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

const NL_EXAMPLES = [
  '2日目をもう少しゆっくりにして',
  '移動距離を減らして',
  '温泉を1つ追加して',
  '3日目は17時までにホテルに着きたい',
]

/**
 * S07 — AI Agent Panel
 *
 * チャットではなく「提案カードの連なり」。AI は質問に答える存在ではなく、
 * 旅程そのものに構造化された変更案（AIProposal）を出し、ユーザーが
 * 差分を見て 1 タップで承認するまでは Store に一切書き込まない
 * （User Request → AI → Structured Proposal → Preview → User Approval → Store Mutation）。
 */
export function AgentPanelScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const warnings = useTripWarnings(id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addSpot, addItem, runOptimize, applyProposal, agentBusy } = useTripsStore()

  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [busy, setBusy] = useState(false)
  const [taken, setTaken] = useState<Set<string>>(new Set())

  const [nlText, setNlText] = useState('')
  const [nlBusy, setNlBusy] = useState(false)
  const [pending, setPending] = useState<AIProposal[] | null>(null)
  const [pendingIndex, setPendingIndex] = useState(0)
  const autoSubmitted = useRef(false)

  // 旅程画面の「AIに候補を出してもらう」などから ?nl=... で来た場合、自動で送信する
  useEffect(() => {
    const nl = searchParams.get('nl')
    if (!nl || autoSubmitted.current || !trip || !id) return
    autoSubmitted.current = true
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('nl')
      return next
    })
    void submitNaturalLanguage(nl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, trip, id])

  if (!trip || !id) return <Navigate to="/" replace />

  const stats = tripStats(trip)

  function push(b: NewBubble) {
    setBubbles((prev) => [...prev, { ...b, id: uid('b') } as Bubble])
  }

  async function submitNaturalLanguage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || nlBusy) return
    setNlBusy(true)
    setPending(null)
    push({ kind: 'text', body: `「${trimmed}」ですね。案を考えます。` })
    try {
      const proposals = await aiAgent.proposeItineraryChanges(trip!, trimmed)
      setPending(proposals)
      setPendingIndex(0)
      setNlText('')
    } finally {
      setNlBusy(false)
    }
  }

  function adoptPending() {
    if (!pending) return
    const proposal = pending[pendingIndex]
    applyProposal(id!, proposal)
    push({ kind: 'text', body: `適用しました: ${proposal.summary}` })
    setPending(null)
    void runOptimize(id!)
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
    push({ kind: 'text', body: '営業時間・移動時間・滞在余裕・旅程密度・予算を確認します。' })
    try {
      await runOptimize(id!)
      push({ kind: 'check', body: '確認しました。' })
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
        質問に答えるのではなく、旅程そのものに手を入れます。変更は必ず案として見せてから、あなたが選んで適用します。
      </p>

      <div className="mt-4 text-text-ink/20">
        <Thread variant="plan" progress={Math.min(1, bubbles.length / 4)} showHead />
      </div>

      {/* 自然言語での編集リクエスト */}
      <div className="anim-rise mt-6 rounded-2xl border border-black/8 bg-white/75 p-4">
        <label className="label-caps text-text-ink/40">AI に伝える</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNaturalLanguage(nlText)
            }}
            placeholder="例: 2日目をもう少しゆっくりにして"
            className="min-w-0 flex-1 rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] outline-none placeholder:text-text-ink/30 focus:border-brass"
          />
          <Button
            variant="primary"
            disabled={nlBusy || !nlText.trim()}
            onClick={() => void submitNaturalLanguage(nlText)}
          >
            {nlBusy ? '考え中…' : '送る'}
          </Button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {NL_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => void submitNaturalLanguage(ex)}
              disabled={nlBusy}
              className="tap rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-text-ink/50 transition duration-200 ease-passage hover:border-brass disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {pending && pending.length > 0 && (
        <div className="mt-4">
          <ProposalCard
            proposal={pending[pendingIndex]}
            spots={trip.spots}
            currentItinerary={trip.itinerary}
            onApply={adoptPending}
            onNext={() => setPendingIndex((pendingIndex + 1) % pending.length)}
            onDismiss={() => setPending(null)}
            hasNext={pending.length > 1}
          />
        </div>
      )}

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
            <div className="mt-3">
              <TripCheck
                warnings={warnings}
                onSelectWarning={(itemId) =>
                  navigate(`/trip/${id}/plan/itinerary?focus=${itemId}`)
                }
              />
              <Button className="mt-3" onClick={() => navigate(`/trip/${id}/plan/itinerary`)}>
                旅程をひらく
              </Button>
            </div>
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

      {(busy || nlBusy || agentBusy) && (
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
