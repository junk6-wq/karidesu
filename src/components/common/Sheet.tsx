import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** シート内のフォーカス可能な要素。DOM 順に拾う。 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    // 開く前にフォーカスがあった要素。閉じたらそこへ戻す。
    // 戻さないと、シートを閉じたあとフォーカスが body に落ちて
    // キーボード操作の現在地が失われる。
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // シートの外へタブ移動できてしまうと、見えている内容と
      // 操作している場所がずれる。前後の端で輪を閉じる。
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        // overscroll-contain: シート内を下までスクロールしたあと指を動かし続けても
        // 背後のページが動かないようにする（スクロール連鎖の遮断）。
        className="anim-rise relative max-h-[88vh] w-full overflow-y-auto overscroll-contain rounded-t-sheet bg-stone p-6 shadow-sheet sm:max-w-[560px] sm:rounded-sheet"
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-display-m">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="tap -mr-2 -mt-2 rounded-full text-text-ink/65 hover:text-text-ink"
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
