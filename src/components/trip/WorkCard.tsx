import { Link } from 'react-router-dom'
import type { Trip } from '@/types'
import { Photo } from '@/components/common/Photo'
import { Thread } from '@/components/thread/Thread'
import { formatDateRange, daysUntil } from '@/lib/time'
import { tripStats } from '@/lib/tripStats'
import { deriveStatus } from '@/store/tripsStore'

const STATUS_LABEL: Record<string, string> = {
  planning: 'PLANNING',
  upcoming: 'UPCOMING',
  journey: 'ON THE JOURNEY',
  completed: 'MEMORY READY',
}

/**
 * Work Card（S01）— 旅程表ではなく「棚に並んだ作品の表紙」。
 * 情報を詰め込みすぎず、行き先・日程・写真・進行状態にしぼる（29章 10.）。
 */
export function WorkCard({ trip, index = 0 }: { trip: Trip; index?: number }) {
  const status = deriveStatus(trip)
  const stats = tripStats(trip)
  const until = daysUntil(trip.startDate)
  const onJourney = status === 'journey'

  const destination =
    status === 'completed'
      ? `/trip/${trip.id}/memory`
      : onJourney
        ? `/trip/${trip.id}/journey`
        : `/trip/${trip.id}`

  const variant = status === 'completed' ? 'memory' : onJourney ? 'journey' : 'plan'

  return (
    <Link
      to={destination}
      className="anim-rise group block overflow-hidden rounded-card bg-ink text-text-porcelain shadow-card focus-visible:outline-offset-4"
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
    >
      <Photo
        src={trip.coverPhotoUrl}
        alt={`${trip.destination}の写真`}
        seed={trip.title}
        className="aspect-[16/10] w-full sm:aspect-[2/1]"
        imgClassName="transition-transform duration-[900ms] ease-passage group-hover:scale-[1.03]"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
          <span
            className={`label-caps rounded-full border px-2.5 py-1 ${
              onJourney
                ? 'border-brass/60 bg-brass/20 text-brass'
                : 'border-white/25 bg-black/20 text-text-porcelain/80'
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
          {status === 'upcoming' && until >= 0 && (
            <span className="mono-readout text-[12px] text-text-porcelain/70">
              D-{until}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <h2 className="font-display text-display-l leading-none">{trip.title}</h2>
          <p className="mono-readout mt-2 text-[12px] text-text-porcelain/70">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>

          <div className="my-4 text-text-porcelain">
            <Thread
              variant={variant}
              progress={stats.progress}
              pulse={onJourney}
              showHead={onJourney}
            />
          </div>

          <div className="mono-readout text-[12px] text-text-porcelain/85">
            <span>{stats.dayCount} DAYS</span>
          </div>
        </div>
      </Photo>
    </Link>
  )
}
