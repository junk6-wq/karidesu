import { useEffect, useState } from 'react'
import type { Spot } from '@/types'
import { BottomSheet } from '@/components/common/Sheet'
import { Photo } from '@/components/common/Photo'
import { aiAgent } from '@/lib/providers/mockAgent'
import { formatDuration } from '@/lib/time'

/**
 * 「ここはもう行ったことがある」ときに、別の場所へ差し替えるためのシート。
 * 予定を消すのではなく入れ替えるので、旅程は完成したまま保たれる。
 */
export function SpotSwapSheet({
  open,
  destination,
  current,
  excludeNames,
  onClose,
  onSelect,
  onRemove,
}: {
  open: boolean
  destination: string
  current: Spot
  excludeNames: string[]
  onClose: () => void
  onSelect: (next: Spot) => void
  /** 差し替えではなく、そのまま予定から外したいとき。 */
  onRemove?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<Spot[]>([])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    aiAgent
      .suggestAlternatives({ destination, current, excludeNames })
      .then((list) => {
        if (alive) setOptions(list)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // excludeNames は毎回新しい配列になるので、中身を文字列化して依存にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, destination, current.id, excludeNames.join('|')])

  return (
    <BottomSheet open={open} onClose={onClose} title={`${current.name} の代わりに`}>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-black/[0.06]" />
          ))}
        </div>
      ) : options.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 p-5 text-center text-[13px] text-text-ink/65">
          この行き先には、ほかに出せる候補がありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((spot) => (
            <li key={spot.id}>
              <button
                onClick={() => {
                  onSelect(spot)
                  onClose()
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-2 text-left transition duration-200 ease-passage hover:border-brass"
              >
                <Photo
                  src={spot.photoUrls[0]}
                  alt={spot.name}
                  seed={spot.name}
                  className="h-[64px] w-[84px] shrink-0 rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{spot.name}</span>
                  <span className="mono-readout mt-1 block text-[11px] text-text-ink/65">
                    {spot.category} · {formatDuration(spot.estimatedStayMin ?? 60)}
                  </span>
                </span>
                <span className="mono-readout shrink-0 text-brass">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {onRemove && (
        <button
          onClick={() => {
            onRemove()
            onClose()
          }}
          className="tap mt-4 w-full rounded-xl text-[13px] text-text-ink/65 hover:bg-black/[0.04] hover:text-brick"
        >
          差し替えずに、この予定を外す
        </button>
      )}
    </BottomSheet>
  )
}
