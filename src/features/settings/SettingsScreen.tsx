import { Link } from 'react-router-dom'
import { TravelStyleSection } from './TravelStyleSection'
import { PlanningRulesSection } from './PlanningRulesSection'
import { MonitoringSection } from './MonitoringSection'
import { CompanionsSection } from './CompanionsSection'
import { DataSection } from './DataSection'

/**
 * S14 — Settings
 *
 * 「アプリの技術情報」ではなく「Karidesu が旅程をどう作る・監視するかを設定する場所」。
 * 上から順に: 旅行スタイル → プランのルール → AI監視 → 同行者 → データ管理。
 * 上位の 3 セクションほど「今後の旅づくりに効く」設定、下位は運用系という優先順位にしている。
 */
export function SettingsScreen() {
  return (
    <div className="min-h-dvh bg-stone pb-24">
      <header className="mx-auto flex max-w-[720px] items-center gap-3 px-5 pt-[max(24px,env(safe-area-inset-top))]">
        <Link to="/" className="tap label-caps -ml-2 rounded-full px-2 text-text-ink/65">
          ← 棚
        </Link>
      </header>

      <div className="mx-auto max-w-[720px] px-5">
        <h1 className="font-display text-display-m mt-4">設定</h1>
        <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-text-ink/65">
          ここでの設定はAIが旅程を作るときのベースになります。一度登録しておけば、次からの旅行プラン作成が自分好みになります。
        </p>

        <TravelStyleSection />
        <PlanningRulesSection />
        <MonitoringSection />
        <CompanionsSection />
        <DataSection />

        <p className="mono-readout mt-14 text-[11px] text-text-ink/65">PASSAGE</p>
      </div>
    </div>
  )
}
