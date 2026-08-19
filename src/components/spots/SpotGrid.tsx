import { useState } from 'react'
import type { Spot } from '@/types'
import { Photo } from '@/components/common/Photo'
import { formatDuration } from '@/lib/time'

/**
 * スポット候補を一覧で見せて、タップで複数選ぶグリッド。
 * 写真主体のカードで「行きたい場所を選ぶ」体験は保ちつつ、1枚ずつ順に決める
 * デッキ形式はやめ、全体を見渡しながら選び直せる一覧に戻した。
 * 1枚の写真だけでは判断しづらいという声を受け、カードごとに複数枚を
 * タップでめくれるようにしている（スワイプは廃止済みのため矢印タップのみ）。
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

      {/* 写真で行くか判断できるよう、1〜2列に絞って1枚あたりを大きく見せる */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spots.map((spot) => (
          <SpotCard key={spot.id} spot={spot} selected={selected.has(spot.id)} onToggle={() => toggle(spot.id)} />
        ))}
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

function SpotCard({
  spot,
  selected,
  onToggle,
}: {
  spot: Spot
  selected: boolean
  onToggle: () => void
}) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = spot.photoUrls
  const hasMultiple = photos.length > 1

  function step(delta: number, e: React.MouseEvent) {
    e.stopPropagation()
    setPhotoIndex((i) => Math.max(0, Math.min(photos.length - 1, i + delta)))
  }

  return (
    // 内側に写真送りの独立したボタンを持つため、外枠は role="button" の div にする
    // （button の入れ子は無効な HTML になり、クリックが正しく振り分けられない）。
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={`cursor-pointer overflow-hidden rounded-2xl border text-left transition duration-200 ease-passage ${
        selected ? 'border-brass shadow-card' : 'border-white/12 hover:border-white/30'
      }`}
    >
      <Photo src={photos[photoIndex]} alt={spot.name} seed={spot.name} className="aspect-[5/4] w-full">
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />

        <span
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[16px] transition duration-200 ease-passage ${
            selected ? 'bg-brass text-ink' : 'bg-black/45 text-text-porcelain/80'
          }`}
        >
          {selected ? '✓' : '＋'}
        </span>
        <span className="label-caps absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-text-porcelain/85">
          {spot.category}
        </span>

        {hasMultiple && (
          <>
            {photoIndex > 0 && (
              <button
                onClick={(e) => step(-1, e)}
                aria-label="前の写真"
                className="tap absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-[18px] text-text-porcelain hover:bg-black/60"
              >
                ‹
              </button>
            )}
            {photoIndex < photos.length - 1 && (
              <button
                onClick={(e) => step(1, e)}
                aria-label="次の写真"
                className="tap absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-[18px] text-text-porcelain hover:bg-black/60"
              >
                ›
              </button>
            )}
            <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ease-passage ${
                    i === photoIndex ? 'bg-brass' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="truncate text-[16px] font-semibold leading-tight text-text-porcelain">{spot.name}</p>
          <p className="mono-readout mt-1 text-[11px] text-text-porcelain/65">
            滞在 {formatDuration(spot.estimatedStayMin ?? 60)}
            {spot.openingHours ? ` · ${spot.openingHours}` : ''}
          </p>
        </div>
      </Photo>
    </div>
  )
}
