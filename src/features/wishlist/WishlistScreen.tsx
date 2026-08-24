import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWishlistStore } from '@/store/wishlistStore'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/QuestChip'
import { Thread } from '@/components/thread/Thread'
import { DESTINATION_PRESETS } from '@/lib/providers/spotSeeds'
import { INTEREST_TAGS } from '@/lib/providers/spotSeeds'

/**
 * 行きたい場所リスト。Trip とは独立した「旅の前段階」のメモ置き場（12章の要望）。
 * ここに溜めた場所は、行き先未定のまま TripCreate を始めたときの提案の材料になる。
 */
export function WishlistScreen() {
  const { items, removeWishlistDestination } = useWishlistStore()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-24 pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="tap label-caps -ml-2 rounded-full px-2 text-text-ink/50 hover:text-text-ink"
        >
          ← HOME
        </Link>
      </div>

      <p className="label-caps mt-4 text-text-ink/45">WISHLIST</p>
      <h1 className="font-display text-display-m mt-1">行きたい場所</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-text-ink/55">
        まだ旅の計画にはしていない「いつか行きたい」を溜めておく場所です。ここに登録しておくと、次の旅の行き先を決めるときにAIが優先的に提案します。
      </p>

      <Button variant="primary" className="mt-5" onClick={() => setAdding((v) => !v)}>
        {adding ? '閉じる' : '＋ 行きたい場所を追加'}
      </Button>

      {adding && <AddForm onAdded={() => setAdding(false)} />}

      <div className="mt-7 space-y-3">
        {items.map((item) => (
          <article key={item.id} className="anim-rise rounded-2xl border border-black/8 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-semibold">{item.name}</h2>
                {item.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.tags.map((t) => (
                      <span key={t} className="label-caps rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-text-ink/50">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="mt-2 text-[13px] leading-relaxed text-text-ink/60">{item.notes}</p>
                )}
              </div>
              <button
                onClick={() => removeWishlistDestination(item.id)}
                aria-label="削除"
                className="tap shrink-0 text-[12px] text-text-ink/35 hover:text-brick"
              >
                削除
              </button>
            </div>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => navigate(`/trip/new?destination=${encodeURIComponent(item.name)}`)}
            >
              この場所で旅をつくる
            </Button>
          </article>
        ))}

        {items.length === 0 && !adding && (
          <div className="anim-rise rounded-card border border-dashed border-black/15 p-8 text-center">
            <div className="mx-auto mb-6 w-28 text-text-ink/25">
              <Thread variant="locked" />
            </div>
            <p className="text-[13px] leading-relaxed text-text-ink/50">
              まだ何も登録されていません。地名だけでも、思いつく場所を足しておきましょう。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const addWishlistDestination = useWishlistStore((s) => s.addWishlistDestination)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])

  function submit() {
    if (!name.trim()) return
    addWishlistDestination({ name, notes, tags })
    setName('')
    setNotes('')
    setTags([])
    onAdded()
  }

  return (
    <div className="anim-rise mt-4 rounded-2xl border border-black/8 bg-white/75 p-4">
      <label className="block">
        <span className="label-caps text-text-ink/40">場所の名前</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 金沢"
          className="mt-1.5 w-full rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] placeholder:text-text-ink/30 focus:border-brass"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DESTINATION_PRESETS.map((d) => (
          <Chip key={d} active={name === d} onClick={() => setName(d)}>
            {d}
          </Chip>
        ))}
      </div>

      <p className="label-caps mt-4 text-text-ink/40">興味（任意）</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {INTEREST_TAGS.map((tag) => (
          <Chip
            key={tag}
            active={tags.includes(tag)}
            onClick={() =>
              setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
            }
          >
            {tag}
          </Chip>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="label-caps text-text-ink/40">メモ（任意）</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例: 友人がおすすめしていた"
          rows={2}
          className="mt-1.5 w-full resize-none rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[13px] placeholder:text-text-ink/30 focus:border-brass"
        />
      </label>

      <Button variant="primary" className="mt-4" disabled={!name.trim()} onClick={submit}>
        追加する
      </Button>
    </div>
  )
}
