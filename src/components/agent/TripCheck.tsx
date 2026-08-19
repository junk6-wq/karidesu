import { useState } from 'react'
import type { ItineraryWarning, WarningCategory } from '@/types'

const CATEGORY_ORDER: WarningCategory[] = ['opening_hours', 'travel_time', 'rest_margin', 'density', 'budget']

const CATEGORY_LABEL: Record<WarningCategory, string> = {
  opening_hours: '営業時間',
  travel_time: '移動時間',
  rest_margin: '滞在余裕',
  density: '旅程密度',
  budget: '予算',
}

const SEVERITY_DOT: Record<ItineraryWarning['severity'], string> = {
  risk: '🔴',
  warn: '🟠',
  info: '🟡',
}

function dotFor(items: ItineraryWarning[]): string {
  if (items.some((w) => w.severity === 'risk')) return '🔴'
  if (items.length > 0) return '🟠'
  return '🟢'
}

/**
 * TRIP CHECK — runOptimize の warnings をカテゴリ別に一覧表示する（7章）。
 * 「検証しました。」だけで終わらせず、何が・どれだけ気になるかを一目で見せる。
 *
 * compact: 開いた瞬間は結論（🟢/🟠/🔴・要確認件数）だけを1行で見せ、
 * カテゴリ内訳や個別の警告は必要なときだけ開く（29章 1. 情報の4階層）。
 */
export function TripCheck({
  warnings,
  onSelectWarning,
  compact = false,
}: {
  warnings: ItineraryWarning[]
  onSelectWarning?: (itemId: string) => void
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(!compact)

  const byCategory = new Map<WarningCategory, ItineraryWarning[]>()
  CATEGORY_ORDER.forEach((c) => byCategory.set(c, []))
  warnings.forEach((w) => {
    if (w.category && byCategory.has(w.category)) byCategory.get(w.category)!.push(w)
  })

  const summary = (
    <>
      {warnings.length > 0 ? (
        <>
          <p className="mono-readout mt-3 text-[12px] text-brick">要確認 {warnings.length}件</p>
          <ul className="mt-1.5 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>
                <button
                  onClick={() => w.itemId && onSelectWarning?.(w.itemId)}
                  disabled={!w.itemId || !onSelectWarning}
                  className="tap flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-text-ink/65 transition duration-200 ease-passage hover:bg-black/[0.04] disabled:hover:bg-transparent"
                >
                  <span className="shrink-0">{SEVERITY_DOT[w.severity]}</span>
                  <span>{w.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mono-readout mt-3 text-[12px] text-brass">要確認 0件 · 問題ありません</p>
      )}
    </>
  )

  if (compact) {
    return (
      <div className="rounded-xl border border-black/8 bg-white/70">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="tap flex w-full items-center gap-2 px-3.5 py-3 text-left"
        >
          <span className="text-[15px]">{dotFor(warnings)}</span>
          <span className="text-[13px] font-semibold text-text-ink">
            {warnings.length > 0 ? `要確認 ${warnings.length}件` : '問題ありません'}
          </span>
          <span className="label-caps ml-auto text-[10px] text-text-ink/35">
            {expanded ? '閉じる' : 'TRIP CHECK'}
          </span>
        </button>
        {expanded && (
          <div className="border-t border-black/6 px-3.5 pb-3.5 pt-1">
            <ul className="mt-2 space-y-1.5">
              {CATEGORY_ORDER.map((cat) => {
                const items = byCategory.get(cat) ?? []
                return (
                  <li key={cat} className="flex items-center gap-2 text-[13px]">
                    <span>{dotFor(items)}</span>
                    <span className="text-text-ink/75">{CATEGORY_LABEL[cat]}</span>
                    {items.length > 0 && (
                      <span className="mono-readout ml-auto text-[11px] text-text-ink/40">
                        {items.length}件
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {summary}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="label-caps text-text-ink/40">TRIP CHECK</p>
      <ul className="mt-2 space-y-1.5">
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat) ?? []
          return (
            <li key={cat} className="flex items-center gap-2 text-[13px]">
              <span>{dotFor(items)}</span>
              <span className="text-text-ink/75">{CATEGORY_LABEL[cat]}</span>
              {items.length > 0 && (
                <span className="mono-readout ml-auto text-[11px] text-text-ink/40">{items.length}件</span>
              )}
            </li>
          )
        })}
      </ul>
      {summary}
    </div>
  )
}
