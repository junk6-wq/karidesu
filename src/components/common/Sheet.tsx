import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * 下から出るシート。スポット詳細・編集など、遷移させたくない編集に使う。
 *
 * document.body に Portal で描画する。祖先要素（TripLayout の
 * .anim-mode-switch 等）がモード切替アニメーションの transform を
 * 使っていると、その要素が position:fixed の containing block になり、
 * ビューポート基準ではなくページ全体の高さ基準で配置されてしまうため
 * （画面外に落ちて開けなくなる）。Portal で回避する。
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] anim-fade"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-rise relative max-h-[88vh] w-full overflow-y-auto rounded-t-sheet bg-stone p-6 shadow-sheet sm:max-w-[560px] sm:rounded-sheet"
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-display text-display-m">{title}</h2>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="tap -mr-2 -mt-2 rounded-full text-text-ink/50 hover:text-text-ink"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * 上から静かに降りてくるシート。
 * 10章の方針どおり、遅延検知はモーダルで割り込まず、この非破壊的 UI で伝える。
 */
export function TopSheet({
  open,
  children,
  tone = 'dark',
}: {
  open: boolean
  children: ReactNode
  tone?: 'light' | 'dark'
}) {
  if (!open) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(16px,env(safe-area-inset-top))]">
      <div
        className={`anim-slide-down pointer-events-auto w-full max-w-[680px] rounded-sheet shadow-sheet ${
          tone === 'dark'
            ? 'border border-white/12 bg-[color:var(--c-surface-dark)]/95 text-text-porcelain'
            : 'border border-black/10 bg-stone text-text-ink'
        } backdrop-blur-md`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
