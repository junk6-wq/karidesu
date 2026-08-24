import { useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '@/store/tripsStore'
import { Thread } from '@/components/thread/Thread'
import { currentMode, modesFor, type Mode } from './modes'
import { currentSection, sectionsFor } from './sections'

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
  const sections = sectionsFor(trip, active)
  const activeSection = currentSection(location.pathname, sections)
  const unlockedModeCount = modes.filter((m) => m.unlocked).length

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
      className={`min-h-dvh ${
        dark ? 'scheme-dark bg-ink text-text-porcelain' : 'bg-stone text-text-ink'
      }`}
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
          {/* モードに属さない単発の操作は、タブ行ではなくここに並べる */}
          <Link
            to={`/trip/${trip.id}/share`}
            aria-label="この旅を共有する"
            className={`tap label-caps flex items-center rounded-full border px-3 ${
              dark
                ? 'border-white/20 text-text-porcelain/70'
                : 'border-black/12 text-text-ink/60'
            }`}
          >
            共有
          </Link>
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

        {/* モード行は「切り替えられるとき」だけ出す。計画中は JOURNEY/MEMORY が
            日付ロックで押しても進めず、sticky ヘッダーの高さだけを食っていた。
            次に何が解禁されるかは Overview のカウントダウンが伝える。 */}
        {unlockedModeCount >= 2 && (
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
        )}

        {/* モード内のセクション。日常的に一番使う移動なので、常に出しておく */}
        {sections.length > 0 && (
          <nav
            className={`mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-4 pb-1.5 ${
              dark ? 'border-t border-white/8' : 'border-t border-black/6'
            }`}
          >
            {sections.map((s) => {
              const on = s.id === activeSection
              return (
                <Link
                  key={s.id}
                  to={s.path}
                  aria-current={on ? 'page' : undefined}
                  className={`tap relative inline-flex shrink-0 items-center justify-center px-3.5 text-[13px] transition duration-200 ease-passage ${
                    on
                      ? dark
                        ? 'font-semibold text-text-porcelain'
                        : 'font-semibold text-text-ink'
                      : dark
                        ? 'text-text-porcelain/45 hover:text-text-porcelain/75'
                        : 'text-text-ink/45 hover:text-text-ink/75'
                  }`}
                >
                  {s.label}
                  {/* 選択中の下線。モードタブの THE THREAD と同じ「線で現在地を示す」扱い */}
                  <span
                    className={`absolute inset-x-3 bottom-1 h-0.5 rounded-full transition-opacity duration-200 ease-passage ${
                      on ? 'bg-brass opacity-100' : 'opacity-0'
                    }`}
                  />
                </Link>
              )
            })}
          </nav>
        )}
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
    // 解禁条件は画面のどこにも残らず消えるので、読み上げにも同じ内容を流す。
    // assertive ではなく polite: 操作を遮るほどの緊急性はない。
    <div
      role="status"
      aria-live="polite"
      className="anim-slide-down pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-5"
    >
      <div className="flex items-center gap-3 rounded-full border border-white/12 bg-ink/95 px-4 py-2.5 text-[13px] text-text-porcelain shadow-sheet">
        <span className="w-8 text-text-porcelain/40">
          <Thread variant="locked" />
        </span>
        {note}
      </div>
    </div>
  )
}
