import type { DefaultTravelMode, PaceLevel } from '@/types'
import { usePreferencesStore } from '@/store/preferencesStore'
import { SettingsSection } from './components/SettingsSection'
import { ChoiceGroup, MultiChoiceGroup } from './components/ChoiceGroup'
import { ToggleRow } from './components/ToggleRow'
import { NumberStepper } from './components/NumberStepper'
import { INTEREST_TAGS } from '@/lib/providers/spotSeeds'

const TRAVEL_MODE_OPTIONS: { value: DefaultTravelMode; label: string }[] = [
  { value: 'car', label: '車' },
  { value: 'train', label: '電車' },
  { value: 'flight', label: '飛行機' },
  { value: 'other', label: 'その他' },
]

const PACE_OPTIONS: { value: PaceLevel; label: string }[] = [
  { value: 'relaxed', label: 'ゆっくり' },
  { value: 'balanced', label: 'ほどよく' },
  { value: 'packed', label: 'たっぷり' },
]

const DRIVE_LIMIT_OPTIONS: { value: string; label: string }[] = [
  { value: '120', label: '2時間以内' },
  { value: '180', label: '3時間以内' },
  { value: '240', label: '4時間以内' },
  { value: 'none', label: '特に制限なし' },
]

/**
 * 1. 自分の旅行スタイル
 * ここで登録した好みが、旅行作成時の初期値（興味・テンポ・人数）に反映される。
 */
export function TravelStyleSection() {
  const { travelStyle } = usePreferencesStore((s) => s.preferences)
  const updateTravelStyle = usePreferencesStore((s) => s.updateTravelStyle)

  return (
    <SettingsSection
      eyebrow="TRAVEL STYLE"
      title="自分の旅行スタイル"
      description="ここで登録しておくと、次に旅をつくるときの初期設定として使われます。"
    >
      <label className="block rounded-2xl border border-black/8 bg-white/70 p-4">
        <span className="text-[14px] font-semibold text-text-ink">出発地</span>
        <p className="mt-0.5 text-[12px] leading-relaxed text-text-ink/45">
          いつもの旅の出発地点（例: 水戸）
        </p>
        <input
          value={travelStyle.departure}
          onChange={(e) => updateTravelStyle({ departure: e.target.value })}
          placeholder="例: 水戸"
          className="mt-2.5 w-full rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[15px] outline-none placeholder:text-text-ink/30 focus:border-brass"
        />
      </label>

      <ChoiceGroup
        label="基本の移動手段"
        value={travelStyle.defaultTravelMode}
        onChange={(v) => updateTravelStyle({ defaultTravelMode: v })}
        options={TRAVEL_MODE_OPTIONS}
        multiline
      />

      <NumberStepper
        label="旅行人数"
        hint="いつも一緒に旅する人数の目安"
        value={travelStyle.defaultPartySize}
        onChange={(v) => updateTravelStyle({ defaultPartySize: v })}
        min={1}
        max={8}
        suffix=" 人"
      />

      <MultiChoiceGroup
        label="旅行の好み"
        hint="複数選べます。旅先の提案に使われます。"
        values={travelStyle.interests}
        onToggle={(tag) =>
          updateTravelStyle({
            interests: travelStyle.interests.includes(tag)
              ? travelStyle.interests.filter((t) => t !== tag)
              : [...travelStyle.interests, tag],
          })
        }
        options={INTEREST_TAGS}
      />

      <ChoiceGroup
        label="旅行のテンポ"
        hint="1日にどれくらい予定を詰めるか"
        value={travelStyle.pace}
        onChange={(v) => updateTravelStyle({ pace: v })}
        options={PACE_OPTIONS}
        multiline
      />

      <ChoiceGroup
        label="1日の運転時間の上限"
        value={travelStyle.driveLimitMin === undefined ? 'none' : String(travelStyle.driveLimitMin)}
        onChange={(v) => updateTravelStyle({ driveLimitMin: v === 'none' ? undefined : Number(v) })}
        options={DRIVE_LIMIT_OPTIONS}
        multiline
      />

      <ToggleRow
        label="早朝から動きたい"
        hint="オンにすると、朝早いスポットも積極的に組み込みます"
        checked={travelStyle.earlyStart}
        onChange={(v) => updateTravelStyle({ earlyStart: v })}
      />

      <ToggleRow
        label="夜遅くまで行動したい"
        hint="オンにすると、夜の予定も無理なく候補に入ります"
        checked={travelStyle.lateNight}
        onChange={(v) => updateTravelStyle({ lateNight: v })}
      />

      <label className="block rounded-2xl border border-black/8 bg-white/70 p-4">
        <span className="text-[14px] font-semibold text-text-ink">旅のこだわりメモ</span>
        <p className="mt-0.5 text-[12px] leading-relaxed text-text-ink/45">
          自由に書いてください。将来、AI がこのメモを読み取って旅程作りに活かす予定です（現在は保存のみ）。
        </p>
        <textarea
          value={travelStyle.freeNotes}
          onChange={(e) => updateTravelStyle({ freeNotes: e.target.value })}
          rows={3}
          placeholder="例: 温泉と景色を重視。車移動で1日の運転は4時間以内。予定は詰め込みすぎない。"
          className="mt-2.5 w-full resize-none rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-text-ink/30 focus:border-brass"
        />
      </label>
    </SettingsSection>
  )
}
