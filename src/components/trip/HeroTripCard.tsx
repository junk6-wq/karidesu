import { Link } from 'react-router-dom'
import type { Trip } from '@/types'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { formatDateRange, daysUntil } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'
import { deriveStatus } from '@/store/tripsStore'

/**
 * Home の一番上に置く「次の旅」の入り口（29章 9. Home）。
 * 一覧の1件ではなく、開いた瞬間にワクワクする専用の大きな入口にする。
 */
export function HeroTripCard({ trip }: { trip: Trip }) {
  const status = deriveStatus(trip)
  const stats = tripStats(trip)
  const until = daysUntil(trip.startDate)
  const onJourney = status === 'journey'
  const nights = Math.max(0, stats.dayCount - 1)

  const destination = onJourney ? `/trip/${trip.id}/journey` : `/trip/${trip.id}`

  const statusLine = onJourney
    ? `旅行中 · ${stats.itemCount > 0 ? `${Math.round(stats.progress * 100)}% 進行` : '出発しました'}`
    : until <= 0
      ? '今日から'
      : `あと ${until} 日`

  return (
    <Link
      to={destination}
      className="anim-rise group block overflow-hidden rounded-card bg-ink text-text-porcelain shadow-card focus-visible:outline-offset-4"
    >
      <Photo
        src={trip.coverPhotoUrl}
        alt={`${trip.destination}の写真`}
        seed={trip.title}
        className="aspect-[16/11] w-full sm:aspect-[21/9]"
        imgClassName="transition-transform duration-[900ms] ease-passage group-hover:scale-[1.03]"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
          <span
            className={`label-caps rounded-full border px-2.5 py-1 ${
              onJourney
                ? 'border-brass/60 bg-brass/25 text-brass'
                : 'border-white/25 bg-black/25 text-text-porcelain/85'
            }`}
          >
            {onJourney ? 'ON THE JOURNEY' : 'NEXT TRIP'}
          </span>
          <span className="mono-readout text-[13px] font-semibold text-brass">{statusLine}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <h2 className="font-display text-display-xl leading-none">{trip.title}</h2>
          <p className="mono-readout mt-2.5 text-[13px] text-text-porcelain/75">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>

          <div className="my-4 text-text-porcelain">
            <Thread
              variant={onJourney ? 'journey' : 'plan'}
              progress={stats.progress}
              pulse={onJourney}
              showHead={onJourney}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="mono-readout text-[12px] text-text-porcelain/70">
              🌿 {nights > 0 ? `${nights}泊${stats.dayCount}日の旅` : `${stats.dayCount}日の旅`}
            </span>
            <span className="tap label-caps inline-flex items-center rounded-full bg-brass px-4 text-ink">
              旅を見る
            </span>
          </div>
        </div>
      </Photo>
    </Link>
  )
}
