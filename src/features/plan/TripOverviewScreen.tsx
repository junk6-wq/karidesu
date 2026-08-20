import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip, useTripWarnings, useTripsStore } from '@/store/tripsStore'
import { ProposalCard } from '@/components/agent/ProposalCard'
import { aiAgent } from '@/lib/providers/mockAgent'
import type { AIProposal } from '@/types'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { StatReadout } from '@/components/common/StatReadout'
import { LinkButton } from '@/components/common/Button'
import { MapLayer } from '@/components/map/MapLayer'
import { formatCurrency, formatKm } from '@/lib/format'
import { daysUntil, formatDateRange, weekdayEn } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'
import { modesFor } from '@/features/trip/modes'
import { evaluateDayLoadSync, evaluateTripHealthSync, planCompleteness } from '@/lib/tripHealth'
import type { DayLoad, ItineraryWarning, Trip } from '@/types'

const HEALTH_LABELS: Record<string, string> = {
  moveEfficiency: '移動効率',
  openingHours: '営業時間',
  restMargin: '滞在余裕',
  budget: '予算',
  density: '旅程密度',
  weatherResilience: '天候耐性',
}

const LOAD_COLOR: Record<DayLoad['level'], string> = {
  low: 'var(--c-brass-gold)',
  medium: 'var(--c-amber)',
  high: 'var(--c-brick-coral)',
}

const LOAD_DOT: Record<DayLoad['level'], string> = { low: '🟢', medium: '🟠', high: '🔴' }

/**
 * 見つかった問題から、AI に投げる修正リクエストを自動で組み立てる。
 * ユーザーが AI パネルで文章を打たなくても、開いた時点で直す案が用意されている
 * ようにするための入口。文言は aiProposals のルールが拾える言い回しに合わせる。
 */
interface FixCandidate {
  title: string
  request: string
}

/**
 * 見つかった問題から、AI に投げる修正リクエストの候補を優先順に組み立てる。
 * ルールによっては（例: 移動距離の短縮は 3 件以上ある日にしか効かない）
 * 実際の変更を作れないことがあるので、1 つに絞らず順に試せるよう配列で返す。
 */
function autoFixCandidates(
  trip: Trip,
  dayLoads: DayLoad[],
  warnings: ItineraryWarning[],
): FixCandidate[] {
  const out: FixCandidate[] = []
  const seen = new Set<string>()
  const push = (c: FixCandidate) => {
    if (seen.has(c.request)) return
    seen.add(c.request)
    out.push(c)
  }
  const slowDown = (dayIndex: number, reason: string) =>
    push({
      title: `DAY${dayIndex + 1} ${reason}`,
      request: `DAY${dayIndex + 1}をもう少しゆっくりにして`,
    })
  const dayIndexOfItem = (itemId: string) =>
    trip.itinerary.findIndex((d) => d.items.some((i) => i.id === itemId))

  // 1) 明らかに詰まっている日
  const worst = [...dayLoads].sort((a, b) => b.score - a.score)[0]
  if (worst && worst.level !== 'low') {
    const dayIndex = trip.itinerary.findIndex((d) => d.id === worst.dayId)
    if (dayIndex >= 0) {
      slowDown(dayIndex, worst.level === 'high' ? 'が詰まっています' : 'が少し詰まっています')
    }
  }

  // 2) 個別の警告。重いものから順に、AI が手を入れられる種類だけ拾う
  const bySeverity = [...warnings].sort((a, b) => {
    const rank = { risk: 0, warn: 1, info: 2 } as const
    return rank[a.severity] - rank[b.severity]
  })
  for (const w of bySeverity) {
    if (w.category === 'travel_time') {
      push({ title: '移動に無理があります', request: '移動距離を減らして' })
      // 移動距離の短縮が効かない旅程でも、その日を薄くすれば余裕は作れる
      const dayIndex = dayIndexOfItem(w.itemId)
      if (dayIndex >= 0) slowDown(dayIndex, 'の移動が窮屈です')
    }
    if (w.category === 'rest_margin' || w.category === 'density') {
      const dayIndex = dayIndexOfItem(w.itemId)
      if (dayIndex >= 0) slowDown(dayIndex, 'に余裕がありません')
    }
  }
  return out
}

function nextActionText(trip: Trip, dayLoads: DayLoad[], warnings: ItineraryWarning[]): string {
  const emptyDayIndex = trip.itinerary.findIndex((d) => d.items.length === 0)
  if (emptyDayIndex !== -1) {
    return `DAY${emptyDayIndex + 1} にまだ予定がありません。スポットを追加しましょう。`
  }
  const risky = warnings.find((w) => w.severity === 'risk')
  if (risky) return risky.message

  const worst = [...dayLoads].sort((a, b) => b.score - a.score)[0]
  if (worst && worst.level === 'high') {
    const dayIndex = trip.itinerary.findIndex((d) => d.id === worst.dayId)
    return `DAY${dayIndex + 1} を少し調整すると、かなり良くなります。`
  }
  if (warnings.length > 0) return `気になる点が ${warnings.length} 件あります。AIで確認しましょう。`
  return '順調です。このまま準備を進めましょう。'
}

/**
 * S03 — Trip Overview（表紙）
 * 旅程表ではなく、旅全体のビジュアルサマリー。
 */
export function TripOverviewScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const warnings = useTripWarnings(id)
  const { runOptimize, applyProposal } = useTripsStore()
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [autoFix, setAutoFix] = useState<{ proposal: AIProposal; title: string } | null>(null)
  const [autoBusy, setAutoBusy] = useState(false)

  const dayLoads = useMemo(() => (trip ? evaluateDayLoadSync(trip) : []), [trip])

  // 開いた時点で AI が検証を済ませておく。これまでは旅程画面を開くまで
  // 走らず、作ったばかりの旅では TRIP HEALTH が未検証の値のままだった。
  useEffect(() => {
    if (id) void runOptimize(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 見つかった問題に対する直し方も、聞かれる前に用意しておく。
  // 候補を順に試し、実際に旅程を変えられる案が出た時点で止める。
  const candidates = trip ? autoFixCandidates(trip, dayLoads, warnings) : []
  const candidatesKey = candidates.map((c) => c.request).join('|')
  useEffect(() => {
    if (!trip || candidates.length === 0) {
      setAutoFix(null)
      return
    }
    let alive = true
    setAutoBusy(true)
    void (async () => {
      for (const c of candidates) {
        const list = await aiAgent.proposeItineraryChanges(trip, c.request)
        if (!alive) return
        const usable = list.find((p) => p.changes.length > 0)
        if (usable) {
          setAutoFix({ proposal: usable, title: c.title })
          setAutoBusy(false)
          return
        }
      }
      if (alive) {
        setAutoFix(null)
        setAutoBusy(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, candidatesKey])

  if (!trip) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const until = daysUntil(trip.startDate)
  const modes = modesFor(trip)
  const journey = modes.find((m) => m.id === 'journey')

  const health = evaluateTripHealthSync(trip, warnings)
  const completeness = planCompleteness(trip, warnings)
  const nextAction = nextActionText(trip, dayLoads, warnings)

  function acceptAutoFix() {
    if (!autoFix || !id) return
    applyProposal(id, autoFix.proposal)
    setAutoFix(null)
    void runOptimize(id)
  }

  return (
    <div className="pb-24">
      <Photo
        src={trip.coverPhotoUrl}
        alt={`${trip.destination}の表紙写真`}
        seed={trip.title}
        className="h-[46vh] min-h-[280px] w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-stone via-stone/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <p className="mono-readout text-[12px] text-text-ink/60">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.destination}
          </p>
          <h1 className="font-display text-display-xl mt-1">{trip.title}</h1>
        </div>
      </Photo>

      <div className="mx-auto max-w-[1200px] px-5">
        {/* 出発カウントダウン */}
        {until > 0 && (
          <div className="mt-6 flex items-center gap-4 rounded-card border border-black/10 bg-white/70 p-5">
            <span className="mono-readout text-[34px] leading-none text-brass">D-{until}</span>
            <span className="text-[13px] leading-relaxed text-text-ink/60">
              出発まであと {until} 日。<br />
              当日になると JOURNEY モードが自動で開きます。
            </span>
          </div>
        )}
        {until <= 0 && journey?.unlocked && (
          <Link
            to={`/trip/${trip.id}/journey`}
            className="mt-6 flex items-center justify-between gap-4 rounded-card bg-ink p-5 text-text-porcelain"
          >
            <span>
              <span className="label-caps text-brass">ON THE JOURNEY</span>
              <span className="mt-1 block text-[15px]">いま、この旅の中にいます</span>
            </span>
            <span className="mono-readout text-brass">→</span>
          </Link>
        )}

        <div className="mt-7 text-text-ink/25">
          <Thread variant="plan" progress={stats.progress} showHead={stats.progress > 0} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatReadout label="DAYS" value={stats.dayCount} />
          <StatReadout label="DISTANCE" value={formatKm(stats.distanceKm)} />
          <StatReadout label="SPOTS" value={stats.itemCount} />
          <StatReadout
            label="BUDGET"
            value={formatCurrency(stats.plannedTotal, trip.budget.currency)}
          />
        </div>

        {/* TRIP HEALTH: 旅を「情報表示」ではなく「問題解決」の起点にする */}
        <div className="mt-8 rounded-card border border-black/10 bg-white/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label-caps text-text-ink/45">TRIP HEALTH</p>
              <p className="font-display mt-1 leading-none">
                <span className="text-[42px]">{health.score}</span>
                <span className="ml-1 text-[15px] text-text-ink/40">/ 100</span>
              </p>
            </div>
            <LinkButton to={`/trip/${trip.id}/agent`} variant="primary">
              AIで改善
            </LinkButton>
          </div>

          {/* 内訳は数字が並ぶだけで直接の行動には繋がらないため、既定では畳んでおく */}
          {showBreakdown && (
            <div className="anim-fade mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {Object.entries(health.breakdown).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <p className="label-caps truncate text-text-ink/35">{HEALTH_LABELS[key] ?? key}</p>
                  <p className="mono-readout mt-0.5 text-[15px] text-text-ink">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-text-ink/65">
            <span>
              旅程 <b className="mono-readout text-brass">{completeness}%</b> 完成
            </span>
            <span>
              要確認{' '}
              <b className={`mono-readout ${warnings.length > 0 ? 'text-brick' : 'text-brass'}`}>
                {warnings.length}
              </b>{' '}
              件
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-text-ink/60">{nextAction}</p>

          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="tap mt-1 text-[12px] text-text-ink/45 underline decoration-dotted underline-offset-2"
          >
            {showBreakdown ? '内訳を閉じる' : '内訳を見る'}
          </button>
        </div>

        {/* 聞かれる前に用意しておいた直し方。1タップで適用できる */}
        {autoBusy && !autoFix && (
          <p className="mono-readout mt-4 text-[12px] text-text-ink/40">
            AI が直し方を探しています…
          </p>
        )}
        {autoFix && (
          <div className="mt-4">
            <p className="label-caps mb-2 text-text-ink/45">AI が見つけた改善 · {autoFix.title}</p>
            <ProposalCard
              proposal={autoFix.proposal}
              spots={trip.spots}
              currentItinerary={trip.itinerary}
              onApply={acceptAutoFix}
              onNext={() => setAutoFix(null)}
              onDismiss={() => setAutoFix(null)}
              hasNext={false}
            />
          </div>
        )}

        {/* 旅の骨格 */}
        <section className="mt-11 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <h2 className="label-caps text-text-ink/45">ROUTE</h2>
            <div className="mt-3 overflow-hidden rounded-card border border-black/10">
              <MapLayer
                markers={trip.itinerary.flatMap((day) =>
                  day.items.flatMap((item) => {
                    const spot = trip.spots.find((s) => s.id === item.spotId)
                    return spot
                      ? [
                          {
                            id: item.id,
                            position: spot.location,
                            label: spot.name,
                            state: item.actualArrival ? ('done' as const) : ('future' as const),
                          },
                        ]
                      : []
                  }),
                )}
                progress={stats.progress}
                className="h-[320px] w-full"
                interactive={false}
              />
            </div>
          </div>

          <div>
            <h2 className="label-caps text-text-ink/45">DAYS</h2>
            <ol className="mt-3 space-y-2">
              {trip.itinerary.map((day, i) => {
                const names = day.items
                  .map((it) => trip.spots.find((s) => s.id === it.spotId)?.name)
                  .filter(Boolean)
                const load = dayLoads.find((d) => d.dayId === day.id)
                return (
                  <li key={day.id}>
                    <Link
                      to={`/trip/${trip.id}/plan/itinerary#${day.id}`}
                      className="flex items-start gap-4 rounded-2xl border border-black/8 bg-white/60 p-4 transition duration-200 ease-passage hover:border-black/20"
                    >
                      <span className="flex shrink-0 flex-col items-start gap-1">
                        <span className="mono-readout text-[12px] text-brass">
                          DAY {String(i + 1).padStart(2, '0')}
                        </span>
                        {load && day.items.length > 0 && (
                          <span
                            className="mono-readout text-[11px]"
                            style={{ color: LOAD_COLOR[load.level] }}
                          >
                            {load.score} {LOAD_DOT[load.level]}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mono-readout block text-[11px] text-text-ink/40">
                          {day.date.slice(5).replace('-', '.')} {weekdayEn(day.date)}
                        </span>
                        <span className="mt-1 block truncate text-[14px]">
                          {names.length ? names.join(' → ') : 'まだ予定がありません'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

      </div>
    </div>
  )
}
