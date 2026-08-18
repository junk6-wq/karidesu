import type { MonitoringPreferences } from '@/types'
import { usePreferencesStore } from '@/store/preferencesStore'
import { SettingsSection } from './components/SettingsSection'
import { StatusBadge, ToggleRow } from './components/ToggleRow'

const ITEMS: { key: keyof MonitoringPreferences; label: string; hint: string }[] = [
  { key: 'openingHours', label: '営業時間・定休日を確認', hint: '休業日と重ならないかチェックします' },
  { key: 'weather', label: '天気を確認', hint: '出発が近づいたら天候の変化を知らせます' },
  { key: 'traffic', label: '交通状況を確認', hint: '渋滞や運休の影響を旅程に反映します' },
  { key: 'hotelPrice', label: 'ホテル価格を確認', hint: '価格変動があれば知らせます' },
  { key: 'reservation', label: '予約状況を確認', hint: '予約の空き状況を見ておきます' },
  { key: 'planSuggestion', label: 'プラン変更を提案', hint: '状況に応じて代替プランを提案します' },
  { key: 'issueNotify', label: '問題があった場合に通知', hint: '対応が必要なときにまとめて知らせます' },
]

/**
 * 3. AIによる旅行監視
 * バックエンド未実装の機能を実装済みのように見せないため、
 * すべての項目に「準備中」バッジを常時表示する。トグルは「実装され次第使いたいか」という意向のみを保存する。
 */
export function MonitoringSection() {
  const monitoring = usePreferencesStore((s) => s.preferences.monitoring)
  const updateMonitoring = usePreferencesStore((s) => s.updateMonitoring)

  return (
    <SettingsSection
      eyebrow="AI MONITORING"
      title="AIによる旅行監視"
      description="旅の前後にAIが状況を見張ってくれる機能です。準備中のため、オンにした項目は対応が完了し次第使えるようになります。"
    >
      {ITEMS.map((item) => (
        <ToggleRow
          key={item.key}
          label={item.label}
          hint={item.hint}
          checked={monitoring[item.key]}
          onChange={(v) => updateMonitoring({ [item.key]: v })}
          badge={<StatusBadge>準備中</StatusBadge>}
        />
      ))}
    </SettingsSection>
  )
}
