import { Link } from 'react-router-dom'
import { deriveStatus, sortTripsForShelf, useTripsStore } from '@/store/tripsStore'
import { WorkCard } from '@/components/trip/WorkCard'
import { HeroTripCard } from '@/components/trip/HeroTripCard'
import { Thread } from '@/components/thread/Thread'

/**
 * S01 — Home（旅の棚）
 * 単なる一覧ではなく、開いた瞬間に「次の旅」が主役として目に入る画面にする（29章 9.）。
 */
export function HomeScreen() {
  const trips = useTripsStore((s) => s.trips)
  const shelf = sortTripsForShelf(trips)
  const hero = shelf[0] && deriveStatus(shelf[0]) !== 'completed' ? shelf[0] : undefined
  const rest = hero ? shelf.slice(1) : shelf

  return (
    <div className="min-h-dvh bg-stone pb-[120px]">
      <header className="mx-auto flex max-w-[900px] items-end justify-between gap-4 px-5 pb-6 pt-[max(28px,env(safe-area-inset-top))]">
        <div>
          <p className="label-caps text-text-ink/45">PASSAGE</p>
          <h1 className="font-display text-display-l mt-1">旅の棚</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/wishlist"
            className="tap label-caps flex items-center rounded-full border border-black/12 px-4 text-text-ink/60 hover:border-black/30"
          >
            WISHLIST
          </Link>
          <Link
            to="/settings"
            className="tap label-caps flex items-center rounded-full border border-black/12 px-4 text-text-ink/60 hover:border-black/30"
          >
            SETTINGS
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5">
        {shelf.length === 0 ? (
          <EmptyShelf />
        ) : (
          <>
            {hero && <HeroTripCard trip={hero} />}
            {rest.length > 0 && (
              <div className={`grid gap-5 ${hero ? 'mt-7' : ''}`}>
                {rest.map((trip, i) => (
                  <WorkCard key={trip.id} trip={trip} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* 下部固定 CTA。旅を進める行動なので Brass Gold */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-stone via-stone/90 to-transparent px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-10">
        <Link
          to="/trip/new"
          className="tap pointer-events-auto flex w-full max-w-[420px] items-center justify-center rounded-full bg-brass px-6 text-[15px] font-semibold text-ink shadow-card transition duration-200 ease-passage hover:brightness-110"
        >
          + 新しい旅をつくる
        </Link>
      </div>
    </div>
  )
}

function EmptyShelf() {
  return (
    <div className="anim-rise rounded-card border border-black/10 bg-white/60 px-6 py-16 text-center">
      <div className="mx-auto mb-8 w-40 text-text-ink/30">
        <Thread variant="locked" />
      </div>
      <h2 className="font-display text-display-m">まだ、どこへも行っていない。</h2>
      <p className="mx-auto mt-3 max-w-[380px] text-[14px] leading-relaxed text-text-ink/55">
        行き先と日付を決めるところから、旅は始まります。あとは PASSAGE が一緒に組み立てます。
      </p>
      <Link
        to="/trip/new"
        className="tap mt-8 inline-flex items-center justify-center rounded-full bg-brass px-6 font-semibold text-ink"
      >
        最初の旅をつくる
      </Link>
    </div>
  )
}
