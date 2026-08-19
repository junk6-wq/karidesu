import { useState } from 'react'
import type { Spot } from '@/types'
import { Photo } from '@/components/common/Photo'
import { formatDuration } from '@/lib/time'

/**
 * スポット候補を一覧で見せて、タップで複数選ぶグリッド。
 * 写真主体のカードで「行きたい場所を選ぶ」体験は保ちつつ、1枚ずつ順に決める
 * デッキ形式はやめ、全体を見渡しながら選び直せる一覧に戻した。
 */
export function SpotGrid({
  spots,
  onFinish,
  finishLabel = 'この内容で組み立てる',
  busy = false,
}: {
  spots: Spot[]
  onFinish: (taken: Spot[]) => void
  finishLabel?: string
  busy?: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const taken = spots.filter((s) => selected.has(s.id))

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between">
        <span className="mono-readout text-[12px] text-text-porcelain/50">{spots.length} 件の候補</span>
        <span className="mono-readout text-[12px] text-brass">{taken.length} 件えらんだ</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {spots.map((spot) => {
          const on = selected.has(spot.id)
          return (
            <button
              key={spot.id}
              onClick={() => toggle(spot.id)}
              className={`overflow-hidden rounded-2xl border text-left transition duration-200 ease-passage ${
                on ? 'border-brass shadow-card' : 'border-white/12 hover:border-white/30'
              }`}
            >
              <Photo
                src={spot.photoUrls[0]}
                alt={spot.name}
                seed={spot.name}
                className="aspect-[4/3] w-full"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/15 to-transparent" />
                <span
                  className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition duration-200 ease-passage ${
                    on ? 'bg-brass text-ink' : 'bg-black/40 text-text-porcelain/70'
                  }`}
                >
                  {on ? '✓' : '＋'}
                </span>
                <span className="label-caps absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] text-text-porcelain/85">
                  {spot.category}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="truncate text-[13px] font-semibold leading-tight text-text-porcelain">
                    {spot.name}
                  </p>
                  <p className="mono-readout mt-0.5 text-[10px] text-text-porcelain/60">
                    {formatDuration(spot.estimatedStayMin ?? 60)}
                  </p>
                </div>
              </Photo>
            </button>
          )
        })}
      </div>

      {spots.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-white/15 p-6 text-center text-[13px] text-text-porcelain/50">
          候補がありません。
        </p>
      )}

      {taken.length > 0 && (
        <button
          onClick={() => onFinish(taken)}
          disabled={busy}
          className="tap mt-6 flex w-full items-center justify-center rounded-full bg-brass px-6 text-[15px] font-semibold text-ink shadow-card transition duration-200 ease-passage hover:brightness-110 disabled:opacity-50"
        >
          {busy ? '組み立てています…' : `${finishLabel}（${taken.length}件）`}
        </button>
      )}
    </div>
  )
}
