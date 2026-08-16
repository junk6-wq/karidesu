import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTrip, useTripsStore } from '@/store/tripsStore'
import { Photo } from '@/components/common/Photo'
import { Thread, ThreadDraw } from '@/components/thread/Thread'
import { StatReadout } from '@/components/common/StatReadout'
import { Button, LinkButton } from '@/components/common/Button'
import { MapLayer } from '@/components/map/MapLayer'
import { aiAgent } from '@/lib/providers/mockAgent'
import { formatCurrency, formatKm } from '@/lib/format'
import { formatDateDot, formatDateRange, weekdayEn } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'

/**
 * S11 — Memory / Travelogue
 * 写真を貼るのではなく、旅の記録から物語が編まれる。
 * 初回表示時に生成し、以降は編集可能なテキストとしてローカルに保存する。
 */
export function MemoryScreen() {
  const { id } = useParams()
  const trip = useTrip(id)
  const setMemory = useTripsStore((s) => s.setMemory)
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const memory = trip?.memory

  useEffect(() => {
    if (!trip || !id || memory || generating) return
    setGenerating(true)
    aiAgent
      .generateTravelogue(trip)
      .then((entry) => setMemory(id, entry))
      .finally(() => setGenerating(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, memory])

  if (!trip || !id) return <Navigate to="/" replace />

  const stats = tripStats(trip)
  const paragraphs = (memory?.narrative ?? '').split('\n\n').filter(Boolean)
  const opening = paragraphs[0]
  const chapters = paragraphs.slice(1, -1)
  const closing = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : undefined

  const spotById = new Map(trip.spots.map((s) => [s.id, s]))

  if (generating || !memory) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <div className="w-48">
          <ThreadDraw />
        </div>
        <p className="font-display text-display-m mt-8">旅を編んでいます</p>
        <p className="mono-readout mt-3 text-[12px] text-text-porcelain/45">
          {stats.itemCount} SPOTS · {formatKm(stats.distanceKm)}
        </p>
      </div>
    )
  }

  return (
    <article className="pb-28">
      {/* 表紙 */}
      <Photo
        src={memory.heroPhotoUrl ?? trip.coverPhotoUrl}
        alt={`${trip.title}の旅行記`}
        seed={trip.title}
        className="h-[62vh] min-h-[340px] w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/40" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <p className="mono-readout text-[12px] text-text-porcelain/65">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <h1 className="font-display text-display-xl mt-2 leading-none">{trip.title}</h1>
          <div className="mt-5 max-w-[280px]">
            <ThreadDraw />
          </div>
        </div>
      </Photo>

      <div className="mx-auto max-w-[720px] px-6">
        {opening && (
          <p className="font-display mt-12 text-[clamp(22px,3.6vw,30px)] leading-[1.6]">
            {opening}
          </p>
        )}

        {/* 章立ては旅の日ごと */}
        {trip.itinerary.map((day, i) => {
          const items = day.items
          if (items.length === 0) return null
          const hero = items
            .map((it) => spotById.get(it.spotId)?.photoUrls[0])
            .find(Boolean)
          const dayDistance = items.reduce(
            (sum, it) => sum + (it.travelToNext?.distanceKm ?? 0),
            0,
          )
          const dayCost = items.reduce((sum, it) => sum + (it.cost ?? 0), 0)

          return (
            <section key={day.id} className="mt-16">
              <div className="mono-readout flex items-baseline gap-3 text-[12px] text-brass">
                <span>DAY {String(i + 1).padStart(2, '0')}</span>
                <span className="text-text-porcelain/40">
                  {formatDateDot(day.date)} {weekdayEn(day.date)}
                </span>
              </div>

              <Photo
                src={hero}
                alt={`${i + 1}日目の写真`}
                seed={day.id}
                className="mt-4 aspect-[3/2] w-full rounded-card"
              />

              {chapters[i] && (
                <p className="mt-6 text-[16px] leading-[2] text-text-porcelain/85">
                  {chapters[i]}
                </p>
              )}

              <ul className="mono-readout mt-5 space-y-1 text-[12px] text-text-porcelain/45">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="w-10 shrink-0">
                      {item.actualArrival ?? item.plannedArrival ?? '--:--'}
                    </span>
                    <span className="truncate">{spotById.get(item.spotId)?.name ?? '—'}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatReadout label="SPOTS" value={items.length} tone="dark" size="s" />
                  <StatReadout label="DISTANCE" value={formatKm(dayDistance)} tone="dark" size="s" />
                  <StatReadout
                    label="SPENT"
                    value={dayCost ? formatCurrency(dayCost, trip.budget.currency) : '—'}
                    tone="dark"
                    size="s"
                  />
                </div>
              </div>
            </section>
          )
        })}

        {/* THE THREAD の完成形 = 旅の背骨 */}
        <section className="mt-20">
          <p className="label-caps text-text-porcelain/45">THE THREAD</p>
          <div className="mt-4 overflow-hidden rounded-card border border-white/10">
            <MapLayer
              markers={trip.itinerary.flatMap((day) =>
                day.items.flatMap((item) => {
                  const spot = spotById.get(item.spotId)
                  return spot
                    ? [
                        {
                          id: item.id,
                          position: spot.location,
                          label: spot.name,
                          state: 'done' as const,
                        },
                      ]
                    : []
                }),
              )}
              progress={1}
              className="h-[360px] w-full"
              interactive={false}
            />
          </div>
          <div className="mt-4">
            <Thread variant="memory" progress={1} showHead={false} />
          </div>
        </section>

        {closing && (
          <p className="mt-16 text-[16px] leading-[2] text-text-porcelain/85">{closing}</p>
        )}

        {/* 編集 */}
        <div className="mt-14 rounded-card border border-white/10 p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="label-caps text-text-porcelain/45">
              {memory.edited ? 'EDITED' : 'AUTO-GENERATED'}
            </p>
            {!editing && (
              <Button
                tone="dark"
                onClick={() => {
                  setDraft(memory.narrative)
                  setEditing(true)
                }}
              >
                本文を編集
              </Button>
            )}
          </div>

          {editing && (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={14}
                className="mt-4 w-full resize-y rounded-xl border border-white/15 bg-white/5 p-4 text-[14px] leading-[1.9] outline-none focus:border-brass"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setMemory(id, { ...memory, narrative: draft, edited: true })
                    setEditing(false)
                  }}
                >
                  保存
                </Button>
                <Button tone="dark" onClick={() => setEditing(false)}>
                  やめる
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton to={`/trip/${trip.id}/memory/stats`} variant="primary">
            記録を見る
          </LinkButton>
          <LinkButton to={`/trip/${trip.id}/share`} tone="dark">
            共有・書き出し
          </LinkButton>
          <Link
            to={`/trip/${trip.id}`}
            className="tap inline-flex items-center rounded-full px-5 text-[14px] text-text-porcelain/55 hover:text-text-porcelain"
          >
            旅程を見返す
          </Link>
        </div>
      </div>
    </article>
  )
}
