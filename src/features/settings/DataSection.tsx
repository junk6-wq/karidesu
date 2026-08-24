import { useRef, useState } from 'react'
import { useTripsStore } from '@/store/tripsStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { Button } from '@/components/common/Button'
import { SettingsSection } from './components/SettingsSection'
import { remove, save } from '@/lib/storage/local'

/**
 * 5. データ管理
 * 画面の一番下に置き、「すべて削除」は他の操作と枠を分けて危険操作だと分かるようにする。
 */
export function DataSection() {
  const trips = useTripsStore((s) => s.trips)
  const resetPreferences = usePreferencesStore((s) => s.resetPreferences)
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) {
    setNote(m)
    window.setTimeout(() => setNote(null), 2400)
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'passage-trips.json'
    a.click()
    URL.revokeObjectURL(url)
    flash('書き出しました')
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
    if (!window.confirm('保存された旅と設定をすべて削除します。この操作は取り消せません。よろしいですか？'))
      return
    // 空配列で保存する。キーごと消すとデモデータが再生成されてしまう
    save('trips', [])
    remove('journey')
    remove('journey-manual')
    resetPreferences()
    location.reload()
  }

  return (
    <SettingsSection
      eyebrow="DATA"
      title="データ管理"
      description="旅のデータはこの端末にだけ保存されています。"
    >
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportAll}>データを書き出す</Button>
        <Button onClick={() => fileRef.current?.click()}>データを読み込む</Button>
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
      </div>

      {note && <p className="mono-readout text-[12px] text-brass">{note}</p>}

      <div className="rounded-2xl border border-brick/30 bg-brick/[0.05] p-4">
        <p className="text-[13px] font-semibold text-brick">危険な操作</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-ink/65">
          旅の記録と設定がすべて削除され、空の棚から始まります。元に戻すことはできません。
        </p>
        <Button variant="destructive" className="mt-3" onClick={wipe}>
          すべて削除
        </Button>
      </div>
    </SettingsSection>
  )
}
