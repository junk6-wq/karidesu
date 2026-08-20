import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ItineraryDay, Spot, TripContext, WindowCostEstimate } from '@/types'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/QuestChip'
import { Thread } from '@/components/thread/Thread'
import { CostTimingChart } from '@/components/plan/CostTimingChart'
import { DraftItineraryReview } from '@/components/plan/DraftItineraryReview'
import { aiAgent, buildDraftItinerary } from '@/lib/providers/mockAgent'
import {
  COVER_PHOTOS,
  DESTINATION_PRESETS,
  FALLBACK_COVER,
  INTEREST_TAGS,
} from '@/lib/providers/spotSeeds'
import { suggestDestinations, type DestinationSuggestion } from '@/lib/destinationSuggest'
import { suggestBestWindows } from '@/lib/seasonPricing'
import { dateRange, toISODate } from '@/lib/time'
import { useTripsStore } from '@/store/tripsStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useWishlistStore } from '@/store/wishlistStore'

type Step = 0 | 1 | 2 | 3

const PACE_LABEL = {
  relaxed: { label: 'ゆっくり', note: '1 日 2 か所くらい' },
  balanced: { label: 'ほどよく', note: '1 日 3 か所くらい' },
  packed: { label: 'たっぷり', note: '1 日 4 か所以上' },
} as const

function defaultDates() {
  const start = new Date()
  start.setDate(start.getDate() + 30)
  const end = new Date(start)
  end.setDate(start.getDate() + 3)
  return { start: toISODate(start), end: toISODate(end) }
}

/**
 * S02 — Trip 作成 / AI ヒアリング
 * 質問に答える AI ではなく「一緒に骨格を組み立てる共作者」として振る舞わせる。
 */
export function TripCreateScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const createTrip = useTripsStore((s) => s.createTrip)
  const wishlist = useWishlistStore((s) => s.items)

  const [step, setStep] = useState<Step>(0)
  const [destination, setDestination] = useState(searchParams.get('destination') ?? '')
  const [title, setTitle] = useState('')
  const dd = useMemo(defaultDates, [])
  const [startDate, setStartDate] = useState(dd.start)
  const [endDate, setEndDate] = useState(dd.end)
  // 設定画面（旅行スタイル）に登録済みの好みがあれば、それを初期値として使う
  const travelStyle = useMemo(() => usePreferencesStore.getState().preferences.travelStyle, [])
  const [interests, setInterests] = useState<string[]>(
    travelStyle.interests.length > 0 ? travelStyle.interests : ['自然', '食'],
  )
  const [pace, setPace] = useState<TripContext['pace']>(travelStyle.pace)
  const [companions, setCompanions] = useState(travelStyle.defaultPartySize)

  // 行き先未定でも進められるよう、興味・行きたい場所リストから候補を出す
  const [destSuggestions, setDestSuggestions] = useState<DestinationSuggestion[] | null>(null)

  // 休暇期間の中からコスパの良い時期を提案する
  const [dateMode, setDateMode] = useState<'fixed' | 'flexible'>('fixed')
  const [earliestStart, setEarliestStart] = useState(dd.start)
  const [latestEnd, setLatestEnd] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 60)
    return toISODate(d)
  })
  const [flexNights, setFlexNights] = useState(2)
  const [estimates, setEstimates] = useState<WindowCostEstimate[] | null>(null)

  const [thinking, setThinking] = useState(false)
  const [proposals, setProposals] = useState<Spot[]>([])
  const [draftItinerary, setDraftItinerary] = useState<ItineraryDay[] | null>(null)

  const dates = useMemo(
    () => (startDate && endDate && endDate >= startDate ? dateRange(startDate, endDate) : []),
    [startDate, endDate],
  )

  const canGoNext =
    step === 0 ? destination.trim().length > 0 : step === 1 ? dates.length > 0 : true

  function proposeDestinations() {
    setDestSuggestions(suggestDestinations(interests, wishlist))
  }

  function compareWindows() {
    if (!destination.trim() || !earliestStart || !latestEnd) return
    const result = suggestBestWindows({
      destination,
      earliestStart,
      latestEnd,
      nights: flexNights,
      partySize: companions,
    })
    setEstimates(result)
  }

  function pickWindow(e: WindowCostEstimate) {
    setStartDate(e.startDate)
    setEndDate(e.endDate)
  }

  async function askAgent() {
    setThinking(true)
    setStep(3)
    try {
      // overshoot: ペースぴったりより多めに候補を取り、そのまま日に詰め込んでから
      // 「取捨選択」できるようにする（1枚ずつ選んでから組み立てる方式はやめた）
      const spots = await aiAgent.suggestSpots(
        { destination, startDate, endDate, interests, pace, companions },
        { overshoot: true },
      )
      setProposals(spots)
      setDraftItinerary(spots.length ? buildDraftItinerary(spots, dates) : null)
    } finally {
      setThinking(false)
    }
  }

  function removeDraftItem(dayId: string, itemId: string) {
    setDraftItinerary((prev) =>
      prev
        ? prev.map((d) => (d.id === dayId ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d))
        : prev,
    )
  }

  /** AI が組み立てた旅程から、取捨選択で残った分だけで旅をつくる。 */
  function finish() {
    const itinerary = draftItinerary ?? []
    const usedSpotIds = new Set(itinerary.flatMap((d) => d.items.map((i) => i.spotId)))
    const picked = proposals.filter((s) => usedSpotIds.has(s.id))
    const trip = createTrip({
      title: (title.trim() || destination).toUpperCase(),
      destination,
      startDate,
      endDate,
      coverPhotoUrl: COVER_PHOTOS[destination] ?? picked[0]?.photoUrls[0] ?? FALLBACK_COVER,
      spots: picked,
      itinerary: itinerary.length ? itinerary : undefined,
    })
    navigate(`/trip/${trip.id}`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink text-text-porcelain">
      <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? navigate('/') : setStep((step - 1) as Step))}
            className="tap label-caps -ml-2 rounded-full px-2 text-text-porcelain/60 hover:text-text-porcelain"
          >
            ← BACK
          </button>
          <span className="mono-readout text-[12px] text-text-porcelain/50">
            {step + 1} / 4
          </span>
        </header>

        <div className="mt-4 text-text-porcelain/40">
          <Thread variant="plan" progress={(step + 1) / 4} showHead />
        </div>

        <main className="anim-mode-switch mt-10 flex flex-1 flex-col" key={step}>
          {step === 0 && (
            <section>
              <p className="label-caps text-brass">STEP 01</p>
              <h1 className="font-display text-display-l mt-2">どこへ行く？</h1>
              <p className="mt-3 text-[14px] leading-relaxed text-text-porcelain/60">
                地名を入れると、その土地の候補から旅を組み立てはじめます。
              </p>

              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="例: 北海道"
                className="mt-7 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-[18px] outline-none placeholder:text-text-porcelain/30 focus:border-brass"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {DESTINATION_PRESETS.map((d) => (
                  <Chip
                    key={d}
                    tone="dark"
                    active={destination === d}
                    onClick={() => setDestination(d)}
                  >
                    {d}
                  </Chip>
                ))}
              </div>

              {wishlist.length > 0 && (
                <div className="mt-6">
                  <p className="label-caps text-text-porcelain/50">行きたい場所リストから</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {wishlist.map((w) => (
                      <Chip
                        key={w.id}
                        tone="dark"
                        active={destination === w.name}
                        onClick={() => setDestination(w.name)}
                      >
                        {w.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={proposeDestinations}
                  className="tap label-caps rounded-full border border-white/20 px-4 text-text-porcelain/70 hover:border-brass hover:text-brass"
                >
                  まだ決めていない → 行き先を提案してもらう
                </button>

                {destSuggestions && (
                  <div className="anim-rise mt-4 space-y-2">
                    {destSuggestions.length === 0 && (
                      <p className="text-[13px] text-text-porcelain/50">
                        設定画面で興味を選んでおくと、提案の精度が上がります。
                      </p>
                    )}
                    {destSuggestions.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => setDestination(s.name)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition duration-200 ease-passage ${
                          destination === s.name
                            ? 'border-brass bg-brass/10'
                            : 'border-white/15 hover:border-white/35'
                        }`}
                      >
                        <span>
                          <span className="block text-[15px] font-semibold">{s.name}</span>
                          <span className="mt-0.5 block text-[12px] text-text-porcelain/50">{s.reason}</span>
                        </span>
                        {s.source === 'wishlist' && (
                          <span className="label-caps shrink-0 rounded-full bg-white/10 px-2 py-1 text-[9px] text-text-porcelain/60">
                            WISHLIST
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="mt-9 block">
                <span className="label-caps text-text-porcelain/50">旅の名前（任意）</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={destination ? destination.toUpperCase() : 'HOKKAIDO'}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 font-display text-[22px] outline-none placeholder:text-text-porcelain/25 focus:border-brass"
                />
              </label>
            </section>
          )}

          {step === 1 && (
            <section>
              <p className="label-caps text-brass">STEP 02</p>
              <h1 className="font-display text-display-l mt-2">いつ、何日間？</h1>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setDateMode('fixed')}
                  className={`tap label-caps rounded-full border px-4 text-[11px] ${
                    dateMode === 'fixed'
                      ? 'border-brass bg-brass/15 text-brass'
                      : 'border-white/20 text-text-porcelain/60 hover:border-white/40'
                  }`}
                >
                  日付を決めて入れる
                </button>
                <button
                  onClick={() => setDateMode('flexible')}
                  className={`tap label-caps rounded-full border px-4 text-[11px] ${
                    dateMode === 'flexible'
                      ? 'border-brass bg-brass/15 text-brass'
                      : 'border-white/20 text-text-porcelain/60 hover:border-white/40'
                  }`}
                >
                  期間の中で時期を選ぶ
                </button>
              </div>

              {dateMode === 'fixed' && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="label-caps text-text-porcelain/50">出発</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        if (endDate < e.target.value) setEndDate(e.target.value)
                      }}
                      className="mono-readout mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-brass"
                    />
                  </label>
                  <label className="block">
                    <span className="label-caps text-text-porcelain/50">帰着</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mono-readout mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-brass"
                    />
                  </label>
                </div>
              )}

              {dateMode === 'flexible' && (
                <div className="mt-6">
                  <p className="text-[13px] leading-relaxed text-text-porcelain/55">
                    休める期間の範囲を入れると、その中で泊数分の旅をどこから始めると得か、費用の目安を比べます。
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="label-caps text-text-porcelain/50">休暇の開始（最短）</span>
                      <input
                        type="date"
                        value={earliestStart}
                        onChange={(e) => {
                          setEarliestStart(e.target.value)
                          setEstimates(null)
                        }}
                        className="mono-readout mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-brass"
                      />
                    </label>
                    <label className="block">
                      <span className="label-caps text-text-porcelain/50">休暇の終了（最長）</span>
                      <input
                        type="date"
                        value={latestEnd}
                        min={earliestStart}
                        onChange={(e) => {
                          setLatestEnd(e.target.value)
                          setEstimates(null)
                        }}
                        className="mono-readout mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-brass"
                      />
                    </label>
                  </div>

                  <label className="mt-6 block">
                    <span className="label-caps text-text-porcelain/50">何泊する？</span>
                    <div className="mt-2 flex items-center gap-3">
                      <Button
                        tone="dark"
                        onClick={() => {
                          setFlexNights(Math.max(1, flexNights - 1))
                          setEstimates(null)
                        }}
                        aria-label="泊数を減らす"
                      >
                        −
                      </Button>
                      <span className="mono-readout w-14 text-center text-[20px]">
                        {flexNights} 泊
                      </span>
                      <Button
                        tone="dark"
                        onClick={() => {
                          setFlexNights(flexNights + 1)
                          setEstimates(null)
                        }}
                        aria-label="泊数を増やす"
                      >
                        ＋
                      </Button>
                    </div>
                  </label>

                  <Button
                    variant="primary"
                    className="mt-5"
                    disabled={!destination.trim() || !earliestStart || !latestEnd}
                    onClick={compareWindows}
                  >
                    時期を比較する
                  </Button>
                  {!destination.trim() && (
                    <p className="mt-2 text-[12px] text-text-porcelain/40">
                      先に STEP 01 で行き先を入れてください（未定候補でも構いません）。
                    </p>
                  )}

                  {estimates && estimates.length > 0 && (
                    <div className="anim-rise mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
                      <CostTimingChart
                        estimates={estimates}
                        currency="JPY"
                        selectedStart={startDate}
                        onSelect={pickWindow}
                        tone="dark"
                      />
                    </div>
                  )}
                  {estimates && estimates.length === 0 && (
                    <p className="mt-4 text-[13px] text-text-porcelain/50">
                      この期間と泊数の組み合わせでは候補が作れませんでした。期間を広げてみてください。
                    </p>
                  )}
                </div>
              )}

              <p className="mono-readout mt-6 text-[13px] text-brass">
                {dates.length > 0 ? `${dates.length} DAYS` : '日付を確認してください'}
              </p>

              <label className="mt-9 block">
                <span className="label-caps text-text-porcelain/50">人数</span>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    tone="dark"
                    onClick={() => setCompanions(Math.max(1, companions - 1))}
                    aria-label="人数を減らす"
                  >
                    −
                  </Button>
                  <span className="mono-readout w-10 text-center text-[20px]">{companions}</span>
                  <Button
                    tone="dark"
                    onClick={() => setCompanions(companions + 1)}
                    aria-label="人数を増やす"
                  >
                    ＋
                  </Button>
                </div>
              </label>
            </section>
          )}

          {step === 2 && (
            <section>
              <p className="label-caps text-brass">STEP 03</p>
              <h1 className="font-display text-display-l mt-2">どんな旅にする？</h1>

              <p className="label-caps mt-8 text-text-porcelain/50">興味</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    tone="dark"
                    active={interests.includes(tag)}
                    onClick={() =>
                      setInterests((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                      )
                    }
                  >
                    {tag}
                  </Chip>
                ))}
              </div>

              <p className="label-caps mt-9 text-text-porcelain/50">ペース</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(Object.keys(PACE_LABEL) as (keyof typeof PACE_LABEL)[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setPace(key)}
                    className={`tap rounded-2xl border px-4 py-3 text-left transition duration-200 ease-passage ${
                      pace === key
                        ? 'border-brass bg-brass/15'
                        : 'border-white/15 hover:border-white/35'
                    }`}
                  >
                    <span className="block text-[15px] font-semibold">
                      {PACE_LABEL[key].label}
                    </span>
                    <span className="mono-readout mt-1 block text-[11px] text-text-porcelain/50">
                      {PACE_LABEL[key].note}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="flex h-full flex-col">
              <p className="label-caps text-brass">STEP 04</p>
              <h1 className="font-display text-display-l mt-2">
                {thinking ? 'AIが組み立てています' : 'AIが組み立てました'}
              </h1>

              {thinking ? (
                <div className="mt-10 space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-2xl bg-white/5"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                  <p className="mono-readout pt-4 text-[12px] text-text-porcelain/45">
                    {destination} / {dates.length} DAYS / {interests.join(' · ') || '指定なし'}
                  </p>
                </div>
              ) : !draftItinerary ? (
                <>
                  <p className="mt-6 rounded-2xl border border-white/10 p-5 text-[14px] leading-relaxed text-text-porcelain/55">
                    この行き先の候補データはまだありません。空の旅程で作成して、スポットを手で足していきましょう。
                  </p>
                  <Button variant="primary" className="mt-5" onClick={finish}>
                    空の旅程でつくる
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[13px] leading-relaxed text-text-porcelain/55">
                    候補を詰め込んで一旦組み立てました。多すぎる日は「外す」で減らしてください。
                  </p>
                  <div className="mt-5 flex flex-1 flex-col">
                    <DraftItineraryReview
                      itinerary={draftItinerary}
                      spots={proposals}
                      pace={pace}
                      onRemoveItem={removeDraftItem}
                      onFinish={finish}
                    />
                  </div>
                </>
              )}
            </section>
          )}
        </main>

        <footer className="sticky bottom-0 mt-10 bg-gradient-to-t from-ink via-ink/95 to-transparent pb-2 pt-6">
          {step < 2 && (
            <Button
              variant="primary"
              className="w-full"
              disabled={!canGoNext}
              onClick={() => setStep((step + 1) as Step)}
            >
              次へ
            </Button>
          )}
          {step === 2 && (
            <Button variant="primary" className="w-full" onClick={askAgent}>
              AI に骨格を組んでもらう
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}
