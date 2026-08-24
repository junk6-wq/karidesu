# PASSAGE

> 旅を、つくる。旅を、生きる。旅を、遺す。

旅行を **PLAN（作る）／ JOURNEY（生きる）／ MEMORY（遺す）** の 3 幕構成として設計した旅アプリ。
3 つのモードは別々の機能群ではなく、**THE THREAD（軌跡の糸）** という 1 本の線で視覚的に地続きになっている。

| モード | THE THREAD の姿 |
| --- | --- |
| PLAN | 点線。まだ確定していない糸 |
| JOURNEY | 実線 + 金色の光点。進むごとに塗りつぶされる |
| MEMORY | 完成した金の軌跡線。旅行記の背骨になる |

## 動かす

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド
npm run preview
```

初回起動時は「進行中の旅」「これからの旅」「終わった旅」のデモが 1 本ずつ入っており、
3 モードすべてをすぐ確認できる。設定 → DATA → すべて削除 で空の棚（S01 の空状態）になる。

## 画面

| ID | 画面 | ルート |
| --- | --- | --- |
| S01 | Home（旅の棚） | `/` |
| S02 | Trip 作成 / AI ヒアリング | `/trip/new` |
| S03 | Trip Overview | `/trip/:id` |
| S04 | Itinerary Timeline | `/trip/:id/plan/itinerary` |
| S05 | Spot Detail / AI 提案 | 旅程画面のシート |
| S06 | Budget | `/trip/:id/plan/budget` |
| S07 | AI Agent Panel | `/trip/:id/agent` |
| S08 | Journey — Next | `/trip/:id/journey` |
| S09 | Journey — Full Route | `/trip/:id/journey/route` |
| S10 | Journey — Re-plan | Next 画面の上部シート |
| S11 | Memory — Travelogue | `/trip/:id/memory` |
| S12 | Memory — Stats | `/trip/:id/memory/stats` |
| S13 | Share / Export | `/trip/:id/share` |
| S14 | Settings / Companions | `/settings` |

JOURNEY は出発日〜帰着日のみ、MEMORY は帰着日を過ぎるとアンロックされる。
未解禁のモードは THE THREAD が途切れた状態で表示され、解禁条件を示す。

## 構成

```
src/
├─ app/                  ルーティング
├─ components/
│  ├─ common/            Button, Chip, QuestChip, Sheet, StatReadout, Photo
│  ├─ thread/            Thread.tsx（シグネチャーコンポーネント）
│  ├─ trip/              WorkCard
│  ├─ itinerary/         TimelineNode
│  ├─ journey/           NextCard, ReplanSheet
│  └─ map/               MapLayer（Leaflet）
├─ features/             画面（plan / journey / memory / home / settings）
├─ lib/
│  ├─ providers/         AIAgentProvider・MapProvider の実装（現在はモック）
│  └─ storage/           localStorage ラッパー
├─ store/                Zustand（tripsStore / journeyStore）
├─ types/                データモデル
└─ styles/tokens.css     デザイントークン
```

## 差し替えポイント

MVP は外部 API キーなしで動く。将来の差し替えはこの 3 箇所で吸収する。

| レイヤー | 現在 | 差し替え先 |
| --- | --- | --- |
| AI エージェント | `MockAIAgentProvider`（`src/lib/providers/mockAgent.ts`） | Claude / Gemini API |
| 地図・場所検索 | `LocalMapProvider`（`src/lib/providers/localMap.ts`） | Google Maps Platform |
| 保存 | `localStorage`（`src/lib/storage/local.ts`） | Supabase / Firebase |

`AIAgentProvider` / `MapProvider` のインターフェースは `src/types/index.ts` に定義してあり、
画面側はインターフェースにしか依存していない。

### モック AI がやっていること

固定ロジックだが、実運用でも効く 3 種類の検証を行う。

- 移動時間の再計算（スポット間の直線距離 × 手段別の巡航速度）と、予定時刻との突き合わせ
- 定休日メモと実際の曜日の衝突チェック
- 1 日の詰め込みすぎ検知

遅延検知は現在地（Geolocation API）と予定時刻の差分から算出し、
`on_time` / `at_risk` / `delayed` の 3 段階で THE THREAD の色相を変える。

## デザイン

搭乗券・コンパス・海図から起こしたパレット。Brass Gold は「進行・確定・希望」を表す唯一のアクセントとして、
全画面で意味を統一している（金色が出たら「進む / 次がある」）。

| 名称 | HEX |
| --- | --- |
| Ink Navy | `#0E1521` |
| Deep Chart Teal | `#173B3A` |
| Stone White | `#EDEEE9` |
| Brass Gold | `#C6A15B` |
| Brick Coral | `#B94A3B` |

タイポグラフィは Instrument Serif / Shippori Mincho（Display）、Manrope / Noto Sans JP（UI）、
IBM Plex Mono（数値）の 3 役割。`prefers-reduced-motion` 指定時は全てクロスフェードのみに縮退する。

## PWA / オフライン

Service Worker がアプリシェルと一度表示した地図タイルをキャッシュするため、
JOURNEY 中に電波が切れても画面は開く。旅のデータ自体は localStorage にあるので通信を必要としない。

## Claude Code 用スキル

| スキル | 中身 |
| --- | --- |
| `passage-ui` | この UI の決まり（3 幕構成・THE THREAD・Brass Gold の意味・画面追加時に触る 3 ファイル・共通部品の一覧）。画面や UI を触るときに自動で読まれる |
| `find-skills` | 他のスキルを探して入れるためのスキル。[vercel-labs/skills](https://github.com/vercel-labs/skills) をそのまま置いたもので、`npx skills` CLI と https://skills.sh/ を使う |
| `frontend-design` | 新しい UI を起こすときの視覚設計。テンプレ然とした既定値に流れないための指針（[anthropics/skills](https://github.com/anthropics/skills)） |
| `accessibility` | WCAG 2.2 に沿った監査と改善。コントラスト・キーボード操作・ARIA など（[addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills)） |
| `vite` | `vite.config.ts`・プラグイン API・ビルド設定（[antfu/skills](https://github.com/antfu/skills)）。**Vite 8 / Rolldown 前提で書かれているので、Vite 5 を使っている本リポジトリでは記述がずれる箇所がある** |
| `web-design-guidelines` | 書いた UI を Vercel の Web Interface Guidelines に照らして監査し、`file:line` で指摘する（[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)）。`frontend-design` が「作る側」、こちらが「見直す側」 |

外部スキルは `npx skills add <owner/repo@skill>` で入れたもの。実体は `.agents/skills/` にあり、
`.claude/skills/` からシンボリックリンクを張っている。出どころとハッシュは `skills-lock.json` に記録され、
`npx skills update` で更新できる。

## デプロイ

PR を開くと `.github/workflows/ci.yml` が型チェックと本番ビルドを走らせる。
`main` への push では `.github/workflows/deploy.yml` が同じ検査をしたうえで GitHub Pages へ配信する。
プロジェクトページ配信のため `BASE_PATH` を渡してビルドし、SPA 直リンク用に `404.html` を複製している。

以前の静的ページは `public/obon-2026.html` に残してあり、`/obon-2026.html` で開ける。
