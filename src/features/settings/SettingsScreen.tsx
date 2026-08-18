import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Trip } from '@/types'
import { useTripsStore } from '@/store/tripsStore'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/QuestChip'
import { uid } from '@/lib/id'
import { remove, save } from '@/lib/storage/local'
import { formatDateRange } from '@/lib/time'

/**
 * S14 — Settings / Companions
 * 同行者・通知・データの持ち出し。MVP で意味のある設定だけを置く。
 */
export function SettingsScreen() {
  const { trips, updateTrip } = useTripsStore()
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) {
    setNote(m)
    window.setTimeout(() => setNote(null), 2400)
  }

  function addCompanion(trip: Trip) {
    const name = window.prompt('同行者の名前')
    if (!name?.trim()) return
    updateTrip(trip.id, {
      companions: [...trip.companions, { id: uid('cmp'), name: name.trim(), role: 'member' }],
    })
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'passage-trips.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importAll(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) throw new Error('形式が違います')
      save('trips', parsed)
      location.reload()
    } catch {
      flash('読み込めませんでした')
    }
  }

  function wipe() {
    if (!window.confirm('保存された旅をすべて削除します。よろしいですか？')) return
    // 空配列で保存する。キーごと消すとデモデータが再生成されてしまう
    save('trips', [])
    remove('journey')
    remove('journey-manual')
    location.reload()
  }

  return (
    <div className="min-h-dvh bg-stone pb-24">
      <header className="mx-auto flex max-w-[720px] items-center gap-3 px-5 pt-[max(24px,env(safe-area-inset-top))]">
        <Link to="/" className="tap label-caps -ml-2 rounded-full px-2 text-text-ink/55">
          ← 棚
        </Link>
      </header>

      <div className="mx-auto max-w-[720px] px-5">
        <h1 className="font-display text-display-m mt-4">設定</h1>

        <section className="mt-9">
          <p className="label-caps text-text-ink/45">COMPANIONS</p>
          <div className="mt-4 space-y-3">
            {trips.map((trip) => (
              <div key={trip.id} className="rounded-2xl border border-black/8 bg-white/70 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-[18px]">{trip.title}</span>
                  <span className="mono-readout text-[11px] text-text-ink/40">
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {trip.companions.map((c) => (
                    <Chip key={c.id}>
                      {c.name}
                      {c.role === 'organizer' ? ' ·幹事' : ''}
                    </Chip>
                  ))}
                  <button
                    onClick={() => addCompanion(trip)}
                    className="tap rounded-full border border-dashed border-black/20 px-3 text-[12px] text-text-ink/50 hover:border-brass"
                  >
                    ＋ 追加
                  </button>
                </div>
              </div>
            ))}
            {trips.length === 0 && (
              <p className="text-[13px] text-text-ink/45">まだ旅がありません。</p>
            )}
          </div>
        </section>

        <section className="mt-11">
          <p className="label-caps text-text-ink/45">AI &amp; MAP</p>
          <div className="mt-4 space-y-2 rounded-2xl border border-black/8 bg-white/70 p-4 text-[13px] leading-relaxed text-text-ink/65">
            <p>
              AI エージェント: <b>モック（固定ロジック）</b> — Claude / Gemini API に差し替え可能
            </p>
            <p>
              地図: <b>Leaflet + OpenStreetMap</b> — Google Maps Platform に差し替え可能
            </p>
            <p>
              保存先: <b>この端末の localStorage</b> — Supabase / Firebase に差し替え可能
            </p>
          </div>
        </section>

        <section className="mt-11">
          <p className="label-caps text-text-ink/45">DATA</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={exportAll}>すべて書き出す</Button>
            <Button onClick={() => fileRef.current?.click()}>読み込む</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importAll(f)
              }}
            />
            <Button variant="destructive" onClick={wipe}>
              すべて削除
            </Button>
          </div>
          <p className="mono-readout mt-4 text-[11px] leading-relaxed text-text-ink/40">
            データはこの端末にだけ保存されています。削除するとデモの旅も消え、空の棚から始められます。
          </p>
        </section>

        {note && <p className="mono-readout mt-6 text-[12px] text-brick">{note}</p>}

        <p className="mono-readout mt-14 text-[11px] text-text-ink/30">PASSAGE · MVP</p>
      </div>
    </div>
  )
}
