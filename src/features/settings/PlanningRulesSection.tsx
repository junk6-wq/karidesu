import { usePreferencesStore } from '@/store/preferencesStore'
import { SettingsSection } from './components/SettingsSection'
import { ChoiceGroup } from './components/ChoiceGroup'
import { ToggleRow } from './components/ToggleRow'

const STAY_OPTIONS = [
  { value: '30', label: '30分' },
  { value: '45', label: '45分' },
  { value: '60', label: '60分' },
  { value: '90', label: '90分' },
]

const MEAL_OPTIONS = [
  { value: '30', label: '30分' },
  { value: '45', label: '45分' },
  { value: '60', label: '60分' },
  { value: '90', label: '90分' },
]

/**
 * 2. 旅行プランのルール
 * AI が旅程を組む・検証するときの前提。細かすぎる項目は増やさず、効果が分かるものだけ置く。
 */
export function PlanningRulesSection() {
  const { planningRules } = usePreferencesStore((s) => s.preferences)
  const updatePlanningRules = usePreferencesStore((s) => s.updatePlanningRules)

  return (
    <SettingsSection
      eyebrow="PLANNING RULES"
      title="旅行プランのルール"
      description="AIが旅程を作る・チェックするときに、これらのルールを基準にします。"
    >
      <ChoiceGroup
        label="1スポットあたりの標準滞在時間"
        value={String(planningRules.standardStayMin)}
        onChange={(v) => updatePlanningRules({ standardStayMin: Number(v) })}
        options={STAY_OPTIONS}
        multiline
      />

      <ChoiceGroup
        label="食事にかける時間"
        value={String(planningRules.mealDurationMin)}
        onChange={(v) => updatePlanningRules({ mealDurationMin: Number(v) })}
        options={MEAL_OPTIONS}
        multiline
      />

      <ToggleRow
        label="移動時間に余裕を持たせる"
        hint="予定と予定の間にゆとりを持たせて組みます"
        checked={planningRules.bufferTime}
        onChange={(v) => updatePlanningRules({ bufferTime: v })}
      />

      <ToggleRow
        label="予定を詰め込みすぎない"
        hint="1日の予定数が多くなりすぎないよう警告します"
        checked={planningRules.avoidOverpacking}
        onChange={(v) => updatePlanningRules({ avoidOverpacking: v })}
      />

      <ToggleRow
        label="同じエリアをまとめる"
        hint="移動が少なくなるよう、近い場所同士を同じ日にまとめます"
        checked={planningRules.groupByArea}
        onChange={(v) => updatePlanningRules({ groupByArea: v })}
      />

      <ToggleRow
        label="雨天時の代替候補を優先する"
        hint="天候が悪い日は屋内スポットを優先的に提案します"
        checked={planningRules.preferRainyAlternatives}
        onChange={(v) => updatePlanningRules({ preferRainyAlternatives: v })}
      />
    </SettingsSection>
  )
}
