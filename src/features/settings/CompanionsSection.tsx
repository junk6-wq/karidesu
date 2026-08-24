import { useState } from 'react'
import type { Trip } from '@/types'
import { sortTripsForShelf, useTripsStore } from '@/store/tripsStore'
import { SettingsSection } from './components/SettingsSection'
import { formatDateRange } from '@/lib/time'

/**
 * 4. 同行者
 * 同行者は Trip に紐づくデータのため、旅ごとの管理という構造自体は維持する。
 * ただし「終わった旅」は下に沈め、これから使う旅を優先して見せる。
 * 追加は window.prompt をやめ、インラインの入力欄にする。
 */
export function CompanionsSection() {
  const trips = useTripsStore((s) => s.trips)
  const ordered = sortTripsForShelf(trips)

  return (
    <SettingsSection
      eyebrow="COMPANIONS"
      title="同行者"
      description="旅ごとに、一緒に行くメンバーを管理します。"
    >
      {ordered.map((trip) => (
        <TripCompanions key={trip.id} trip={trip} />
      ))}
      {ordered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 p-4 text-[13px] text-text-ink/45">
          まだ旅がありません。旅をつくると、ここで同行者を管理できます。
        </p>
      )}
    </SettingsSection>
  )
}

function TripCompanions({ trip }: { trip: Trip }) {
  const { addCompanion, removeCompanion, setCompanionRole } = useTripsStore()
  const [name, setName] = useState('')
  const completed = trip.status === 'completed'

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    addCompanion(trip.id, trimmed)
    setName('')
  }

  return (
    <div
      className={`rounded-2xl border border-black/8 bg-white/70 p-4 ${completed ? 'opacity-70' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[17px]">{trip.title}</span>
        <span className="mono-readout text-[11px] text-text-ink/40">
          {formatDateRange(trip.startDate, trip.endDate)}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {trip.companions.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3 py-2"
          >
            <span className="min-w-0 truncate text-[14px] text-text-ink">{c.name}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() =>
                  setCompanionRole(trip.id, c.id, c.role === 'organizer' ? 'member' : 'organizer')
                }
                className={`tap rounded-full border px-2.5 py-1 text-[11px] transition duration-200 ease-passage ${
                  c.role === 'organizer'
                    ? 'border-brass bg-brass/15 text-[#7a5f2b]'
                    : 'border-black/12 text-text-ink/50 hover:border-black/25'
                }`}
              >
                幹事{c.role === 'organizer' ? '中' : 'にする'}
              </button>
              <button
                onClick={() => removeCompanion(trip.id, c.id)}
                aria-label={`${c.name}を削除`}
                className="tap flex h-8 w-8 items-center justify-center rounded-full text-text-ink/35 hover:bg-brick/10 hover:text-brick"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
        {trip.companions.length === 0 && (
          <li className="text-[12px] text-text-ink/40">同行者がまだいません。</li>
        )}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          aria-label="同行者の名前"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="同行者の名前"
          className="min-w-0 flex-1 rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] placeholder:text-text-ink/30 focus:border-brass"
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="tap shrink-0 rounded-xl border border-dashed border-black/20 px-3.5 text-[13px] text-text-ink/60 transition duration-200 ease-passage hover:border-brass disabled:opacity-40"
        >
          ＋ 追加
        </button>
      </div>
    </div>
  )
}
