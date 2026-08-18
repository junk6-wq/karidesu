import { useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { Thread } from '@/components/thread/Thread'
import { currentMode, modesFor, type Mode } from './modes'

/**
 * Trip のシェル。モードタブ（横スワイプ対応）と、
 * ロックされたモードの解禁条件表示を受け持つ。
 * JOURNEY モードは没入表示のため、この chrome を出さない。
 */
export function TripLayout() {
  const { id } = useParams()
  const trip = useTrip(id)
  const location = useLocation()
  const navigate = useNavigate()
  const [lockedNote, setLockedNote] = useState<string | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  if (!trip) return <Navigate to="/" replace />

  const modes = modesFor(trip)
  const active = currentMode(location.pathname)
  const immersive = active === 'journey'

  function go(mode: Mode) {
    const target = modes.find((m) => m.id === mode)
    if (!target) return
    if (!target.unlocked) {
      setLockedNote(target.lockedHint ?? 'まだ解禁されていません')
      window.setTimeout(() => setLockedNote(null), 2600)
      return
    }
    navigate(target.path)
  }

  // 横スワイプでモードを行き来する（4章）
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.7) return
    const index = modes.findIndex((m) => m.id === active)
    const nextIndex = dx < 0 ? index + 1 : index - 1
    const next = modes[nextIndex]
    if (next) go(next.id)
  }

  if (immersive) {
    return (
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Outlet />
        {lockedNote && <LockedToast note={lockedNote} />}
      </div>
    )
  }

  const dark = active === 'memory'

  return (
    <div
      className={`min-h-dvh ${dark ? 'bg-ink text-text-porcelain' : 'bg-stone text-text-ink'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          dark ? 'border-white/10 bg-ink/85' : 'border-black/8 bg-stone/85'
        }`}
      >
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 pt-[max(12px,env(safe-area-inset-top))]">
          <Link
            to="/"
            className={`tap label-caps -ml-2 flex items-center rounded-full px-2 ${
              dark ? 'text-text-porcelain/60' : 'text-text-ink/55'
            }`}
          >
            ← 棚
          </Link>
          <span className="min-w-0 flex-1 truncate font-display text-[20px]">{trip.title}</span>
          <Link
            to={`/trip/${trip.id}/agent`}
            className={`tap label-caps flex items-center rounded-full border px-3 ${
              dark
                ? 'border-white/20 text-text-porcelain/70'
                : 'border-black/12 text-text-ink/60'
            }`}
          >
            AI
          </Link>
        </div>

        <nav className="mx-auto flex max-w-[1200px] gap-1 px-4 pb-2 pt-1">
          {modes.map((m) => {
            const isActive = m.id === active
            return (
              <button
                key={m.id}
                onClick={() => go(m.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`tap relative flex-1 rounded-full px-3 text-[12px] tracking-[0.14em] transition duration-200 ease-passage ${
                  isActive
                    ? dark
                      ? 'text-brass'
                      : 'text-text-ink'
                    : m.unlocked
                      ? dark
                        ? 'text-text-porcelain/45'
                        : 'text-text-ink/40'
                      : dark
                        ? 'text-text-porcelain/25'
                        : 'text-text-ink/25'
                }`}
                style={{ fontFamily: 'var(--f-mono)' }}
              >
                {m.unlocked ? m.label : `${m.label} ·`}
                <span className="mt-1.5 block">
                  <Thread
                    variant={m.unlocked ? (isActive ? 'journey' : 'plan') : 'locked'}
                    progress={isActive ? 1 : 0}
                    showHead={false}
                    weight={isActive ? 2 : 1}
                  />
                </span>
              </button>
            )
          })}
        </nav>
      </header>

      <main key={active} className="anim-mode-switch">
        <Outlet />
      </main>

      {lockedNote && <LockedToast note={lockedNote} />}
    </div>
  )
}

function LockedToast({ note }: { note: string }) {
  return (
    <div className="anim-slide-down pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-5">
      <div className="flex items-center gap-3 rounded-full border border-white/12 bg-ink/95 px-4 py-2.5 text-[13px] text-text-porcelain shadow-sheet">
        <span className="w-8 text-text-porcelain/40">
          <Thread variant="locked" />
        </span>
        {note}
      </div>
    </div>
  )
}
