import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Spot, TripContext } from '@/types'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/QuestChip'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { aiAgent, buildDraftItinerary } from '@/lib/providers/mockAgent'
import {
  COVER_PHOTOS,
  DESTINATION_PRESETS,
  FALLBACK_COVER,
  INTEREST_TAGS,
} from '@/lib/providers/spotSeeds'
import { dateRange, formatDuration, toISODate } from '@/lib/time'
import { useTripsStore } from '@/store/tripsStore'

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
  const createTrip = useTripsStore((s) => s.createTrip)

  const [step, setStep] = useState<Step>(0)
  const [destination, setDestination] = useState('')
  const [title, setTitle] = useState('')
  const dd = useMemo(defaultDates, [])
  const [startDate, setStartDate] = useState(dd.start)
  const [endDate, setEndDate] = useState(dd.end)
  const [interests, setInterests] = useState<string[]>(['自然', '食'])
  const [pace, setPace] = useState<TripContext['pace']>('balanced')
  const [companions, setCompanions] = useState(2)

  const [thinking, setThinking] = useState(false)
  const [proposals, setProposals] = useState<Spot[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  const dates = useMemo(
    () => (startDate && endDate && endDate >= startDate ? dateRange(startDate, endDate) : []),
    [startDate, endDate],
  )

  const canGoNext =
    step === 0 ? destination.trim().length > 0 : step === 1 ? dates.length > 0 : true

  async function askAgent() {
    setThinking(true)
    setStep(3)
    try {
      const spots = await aiAgent.suggestSpots({
        destination,
        startDate,
        endDate,
        interests,
        pace,
        companions,
      })
      setProposals(spots)
      setChosen(new Set(spots.map((s) => s.id)))
    } finally {
      setThinking(false)
    }
  }

  function finish() {
    const picked = proposals.filter((s) => chosen.has(s.id))
    const trip = createTrip({
      title: (title.trim() || destination).toUpperCase(),
      destination,
      startDate,
      endDate,
      coverPhotoUrl: COVER_PHOTOS[destination] ?? picked[0]?.photoUrls[0] ?? FALLBACK_COVER,
      spots: picked,
      itinerary: picked.length ? buildDraftItinerary(picked, dates) : undefined,
    })
    navigate(`/trip/${trip.id}`, { replace: true })
  }

  const estimatedStay = proposals
    .filter((s) => chosen.has(s.id))
    .reduce((sum, s) => sum + (s.estimatedStayMin ?? 60), 0)

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

        <main className="anim-mode-switch mt-10 flex-1" key={step}>
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

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
            <section>
              <p className="label-caps text-brass">STEP 04</p>
              <h1 className="font-display text-display-l mt-2">
                {thinking ? '旅を組み立てています' : 'この骨格でどうでしょう'}
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
              ) : (
                <>
                  <p className="mt-3 text-[14px] leading-relaxed text-text-porcelain/60">
                    外したいものはタップで外せます。順番と時間はこのあと自由に組み替えられます。
                  </p>

                  <div className="mt-6 space-y-2.5">
                    {proposals.map((spot) => {
                      const on = chosen.has(spot.id)
                      return (
                        <button
                          key={spot.id}
                          onClick={() =>
                            setChosen((prev) => {
                              const next = new Set(prev)
                              if (next.has(spot.id)) next.delete(spot.id)
                              else next.add(spot.id)
                              return next
                            })
                          }
                          className={`flex w-full items-center gap-4 rounded-2xl border p-2.5 pr-4 text-left transition duration-200 ease-passage ${
                            on ? 'border-brass/60 bg-white/[0.07]' : 'border-white/10 opacity-45'
                          }`}
                        >
                          <Photo
                            src={spot.photoUrls[0]}
                            alt={spot.name}
                            className="h-16 w-20 shrink-0 rounded-xl"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">
                              {spot.name}
                            </span>
                            <span className="mono-readout mt-1 block text-[11px] text-text-porcelain/50">
                              {spot.category} · {formatDuration(spot.estimatedStayMin ?? 60)}
                            </span>
                          </span>
                          <span
                            className={`mono-readout text-[16px] ${on ? 'text-brass' : 'text-text-porcelain/30'}`}
                          >
                            {on ? '✓' : '+'}
                          </span>
                        </button>
                      )
                    })}
                    {proposals.length === 0 && (
                      <p className="rounded-2xl border border-white/10 p-5 text-[14px] text-text-porcelain/55">
                        この行き先の候補データはまだありません。空の旅程で作成して、スポットを手で足していきましょう。
                      </p>
                    )}
                  </div>

                  {chosen.size > 0 && (
                    <p className="mono-readout mt-5 text-[12px] text-text-porcelain/45">
                      {chosen.size} SPOTS · 滞在計 {formatDuration(estimatedStay)}
                    </p>
                  )}
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
          {step === 3 && (
            <Button variant="primary" className="w-full" disabled={thinking} onClick={finish}>
              {thinking ? '考え中…' : 'この旅をつくる'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}
