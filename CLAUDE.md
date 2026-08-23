# CLAUDE.md

このリポジトリで作業する AI アシスタント向けのガイド。
コードを触る前にここを読み、README.md（プロダクト側の説明）と合わせて把握すること。

## プロジェクト概要

**PASSAGE** — 旅行を **PLAN（作る）／ JOURNEY（生きる）／ MEMORY（遺す）** の 3 幕構成として設計した
モバイルファーストの旅アプリ。リポジトリ名は `karidesu`、プロダクト名は PASSAGE。

バックエンドは無く、外部 API キーも不要。データは全て `localStorage` に入り、
AI と地図はモック実装（`src/lib/providers/`）で成立させている。
GitHub Pages に静的配信される SPA。

3 モードは別々の機能群ではなく、**THE THREAD（軌跡の糸）** という 1 本の線で視覚的に地続きになっている。
このモチーフは `src/components/thread/Thread.tsx` に集約されていて、全画面で同じ意味を持つ。

## コマンド

```bash
npm install
npm run dev      # Vite 開発サーバ（http://localhost:5173）
npm run lint     # tsc --noEmit（このリポジトリ唯一の静的チェック）
npm run build    # tsc --noEmit && vite build
npm run preview  # ビルド結果の確認
```

- **テストは無い**。ESLint/Prettier も入っていない。変更後は必ず `npm run lint` を通すこと。
  CI（`.github/workflows/deploy.yml`）も `npm run lint` → `npm run build` の順で回している。
- `tsconfig.json` は `strict` に加えて `noUnusedLocals` / `noUnusedParameters` が有効。
  使わない変数・引数を残すと型チェックで落ちる。
- 一時的な検証スクリプトは `*.tmp.mjs` で作れば `.gitignore` 済み。

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| ビルド | Vite 5 + React 18 + TypeScript 5（`type: module`） |
| ルーティング | react-router-dom 6（`BrowserRouter`、basename は `import.meta.env.BASE_URL`） |
| 状態管理 | Zustand 4（永続化は自前の localStorage ラッパー） |
| スタイル | Tailwind CSS 3 + CSS 変数（`src/styles/tokens.css`） |
| 地図 | Leaflet 1.9 + OpenStreetMap タイル（`src/components/map/MapLayer.tsx`） |
| D&D | @dnd-kit（旅程の並べ替えのみ。`ItineraryScreen` / `TimelineNode`） |

インポートは `@/*` エイリアス（`vite.config.ts` と `tsconfig.json` の両方に定義）を使う。相対パスの `../../` は避ける。

## ディレクトリ構成

```
src/
├─ main.tsx              エントリ。BrowserRouter + Service Worker 登録（本番のみ）
├─ app/App.tsx           ルーティング定義（全画面はここに集約）
├─ features/             画面単位。ディレクトリ = モード
│  ├─ home/              S01 旅の棚
│  ├─ plan/              S02〜S07（作成・概要・旅程・スポット・予算・AIパネル）
│  ├─ journey/           S08〜S10（Next / 全日程 / Re-plan 適用ロジック）
│  ├─ memory/            S11〜S13（旅行記・記録・共有）
│  ├─ settings/          S14（セクション単位でファイル分割。components/ に入力部品）
│  ├─ wishlist/          行きたい場所リスト
│  └─ trip/              TripLayout（モードタブ）/ modes.ts / sections.ts
├─ components/           画面をまたいで使う表示部品
│  ├─ common/            Button, Photo, QuestChip, Sheet, StatReadout
│  ├─ thread/            Thread.tsx（シグネチャーコンポーネント）
│  ├─ trip/ itinerary/ journey/ plan/ spots/ agent/ map/
├─ lib/
│  ├─ providers/         mockAgent（AIAgentProvider）/ localMap（MapProvider）/ spotSeeds（種データ）
│  ├─ storage/local.ts   localStorage ラッパー（`passage:` プレフィックス）
│  └─ *.ts               純粋関数のロジック（time / geo / format / tripStats ほか）
├─ store/                Zustand ストア 4 本
├─ types/index.ts        データモデルとプロバイダのインターフェース（全型がここ）
└─ styles/               tokens.css（デザイントークン）+ index.css（Tailwind と共通クラス）
public/
├─ sw.js                 Service Worker（アプリシェル + 地図タイルのキャッシュ）
├─ manifest.webmanifest  PWA マニフェスト
└─ obon-2026.html        旧・静的ページ（/obon-2026.html で残している）
```

## アーキテクチャの要点

### 1. 型は `src/types/index.ts` に集約する

データモデル（`Trip` / `Spot` / `ItineraryDay` / `ItineraryItem` / `Budget` / `MemoryEntry` …）も、
AI・地図のインターフェース（`AIAgentProvider` / `MapProvider`）も全てここ。
画面・ストアは **インターフェースにしか依存しない**（実装差し替えを吸収するため）。
新しい型を足すときも、画面ローカルの UI 型でない限りここに置く。

`Trip` がルートの集約で、`spots`（候補プール）と `itinerary`（日 → 予定）を両方持つ。
`ItineraryItem.spotId` が `Trip.spots` を指す構造なので、スポットを消すときは予定側も一緒に掃除する
（`tripsStore.removeSpot` を参照）。

### 2. ストアは 4 本、更新は必ず「新しい配列を作って persist」

| ストア | キー（localStorage） | 役割 |
| --- | --- | --- |
| `tripsStore` | `passage:trips` | 旅の CRUD、旅程操作、予算、AI 提案の適用 |
| `journeyStore` | `passage:journey` / `passage:journey-manual` | 現在地・遅延・次の目的地 |
| `preferencesStore` | `passage:preferences` | 旅行スタイル・プランのルール・AI 監視設定 |
| `wishlistStore` | `passage:wishlist` | 行きたい場所リスト |

守るべきパターン:

- **イミュータブル更新**。`get().trips.map(...)` で作り直し、`set()` した直後に `persist()` を呼ぶ。
  `persist` を忘れるとリロードで消える。
- `tripsStore` の更新は `touch()` を通す（`updatedAt` 更新 + `deriveStatus()` によるステータス再計算）。
- ステータス（`planning` / `upcoming` / `journey` / `completed`）は**日付から導出**する。
  手で `status` を書き換えないこと。手動指定を尊重するのは `planning` だけ。
- `preferencesStore` の `merge()` のように、**保存済みデータと初期値をマージ**して
  古い localStorage を壊さない。設定項目を足すときは `defaultPreferences()` と `merge()` の両方を更新する。
- セレクタ（`useTrip` / `useTripWarnings` / `sortTripsForShelf`）はストアと同じファイルの末尾に置く。

### 3. AI は「構造化提案 → プレビュー → 承認 → 適用」

自然言語編集も自動提案も、この流れを崩さない:

```
User Request → AI → Structured Proposal (AIProposal) → Validation → Preview → User Approval → Store Mutation
```

- `AIProposal` は `changes: AIProposalChange[]`（`move_item` / `update_time` / `reorder_day` /
  `add_spot` / `remove_item` / `adjust_budget`）と、適用後の状態を先に計算した `previewItinerary` を持つ。
- **承認前に Store へ書き込まない**。差分表示と実適用は同じ関数（`lib/aiProposals.ts` の
  `applyChangesToItinerary`）を通し、プレビューと結果がずれないようにする。
- 提案は文章だけでなく `reason` を数値で裏付ける（例: 「DAY2は移動時間が約3時間10分あります」）。
- 差分の可視化は `lib/proposalDiff.ts`、承認 UI は `components/agent/ProposalCard.tsx`。

### 4. モックプロバイダは「実運用でも効くロジック」で書く

`MockAIAgentProvider`（`src/lib/providers/mockAgent.ts`）は固定ロジックだが、飾りではない:

- 移動時間の再計算（直線距離 × 手段別巡航速度、`lib/geo.ts`）と予定時刻の突き合わせ
- 定休日メモと実際の曜日の衝突チェック
- 1 日の詰め込みすぎ検知（`lib/tripHealth.ts` の `evaluateDayLoadSync` / `evaluateTripHealthSync`）

`think()` による遅延演出は「AI が考えている間」の UX を検証するために意図的に入れてある。消さないこと。

スポットの種データは `src/lib/providers/spotSeeds.ts`。
`regionsFor()` は行き先名に含まれる登録地方名を**出現順に全部**拾い（「東京と京都」→ 両方）、
一致しなければ**空を返す**。無関係な地方の候補で埋める fallback は
「事実と異なる提案になる」という理由で意図的に削除済み（#18）。復活させないこと。

### 5. 差し替えポイントは 3 箇所

| レイヤー | 現在 | 将来 |
| --- | --- | --- |
| AI エージェント | `MockAIAgentProvider`（`lib/providers/mockAgent.ts`） | Claude / Gemini API |
| 地図・場所検索 | `LocalMapProvider`（`lib/providers/localMap.ts`） | Google Maps Platform |
| 保存 | `lib/storage/local.ts` の `load` / `save` / `remove` | Supabase / Firebase |

ストアは `load` / `save` の 2 関数しか知らない。この境界を越える依存を持ち込まない。

### 6. ルーティングとモードの解禁

`src/app/App.tsx` が全ルート。`/trip/:id` 配下は `TripLayout`（モードタブ + セクションタブ）でくるむ。

- **モードの解禁は日付で決まる**（`features/trip/modes.ts`）。JOURNEY は出発日〜帰着日のみ、
  MEMORY は帰着日以降。ロック中は `lockedHint` で解禁条件を必ず示す。
- **JOURNEY は没入表示**。`TripLayout` の chrome（ヘッダー・タブ）を出さない。
- `currentMode()` はパスの部分一致で判定する。
  **モードに属さない単発の画面は `TripLayout` の外に置く**（`/trip/:id/share`、`/trip/:id/pick`）。
  中に入れると `currentMode` が `plan` を返し、テーマもタブも壊れる（#16 で踏んだ実例）。
- モード内の第 2 階層は `features/trip/sections.ts`。画面間を 1 タップで横移動できることを保つ。

## コーディング規約

- **コメント・UI 文言・コミットメッセージは日本語**。既存の密度に合わせる。
- コメントは「何をしているか」ではなく **「なぜそうしたか」** を書く。既存コードは
  過去に踏んだ問題（`// ... だと ~~ が壊れる`）を残す形になっている。この書き方を踏襲すること。
- コード中の `7章` `12章` `16.3` `29章` `30章` といった参照は、リポジトリ外の設計仕様書の章番号。
  ファイルは無いので、参照を追えなくても気にしなくてよい。新しく章番号を書き足さないこと。
- コンポーネントは `export function Xxx()`（default export は使わない）。
- 型は `import type { ... } from '@/types'` で読む。
- 純粋なロジックは `lib/` に切り出し、画面から呼ぶ。`buildContext`（journeyStore）のように
  ストア外でも使える純関数にできるならそうする。
- 画面コンポーネント冒頭の JSDoc に `S04 — Itinerary Timeline` のような画面 ID と意図を書く（既存に倣う）。

### スタイル

- 色・フォント・モーションは `src/styles/tokens.css` の CSS 変数が単一の出所。
  `tailwind.config.js` はそれを参照するだけ。**HEX を直接書かない**。
- 主要トークン: `ink`（#0E1521）/ `chart`（#173B3A）/ `stone`（#EDEEE9）/ `brass`（#C6A15B）/
  `brick`（#B94A3B）/ `amber`（at_risk 専用）。
- **Brass Gold は「進行・確定・希望」を表す唯一のアクセント**。金色が出たら「進む / 次がある」。
  この意味を全画面で統一する。装飾目的で brass を使わない。
- 共通クラス: `.tap`（タッチターゲット 44px 以上）、`.mono-readout`（数値表示）、`.label-caps`（小見出し）。
  押せる要素には `.tap` を付ける。
- アニメーションは `.anim-rise` / `.anim-fade` / `.anim-slide-down` / `.anim-mode-switch` と
  `ease-passage` を使う。`prefers-reduced-motion` は `tokens.css` で一括縮退させてあるので、
  個別対応は不要。
- 写真は `<img>` 直書きではなく `components/common/Photo.tsx` を使う（読み込み失敗時の下地がある）。
- モバイル前提。`min-h-dvh`、`env(safe-area-inset-*)`、`max-w-[720px]` / `max-w-[1200px]` の中央寄せ。
- ダークテーマは MEMORY モードと JOURNEY のみ。`tone`/`dark` フラグを props で渡す既存パターンに合わせる。

## デプロイ

`main` への push で GitHub Actions が GitHub Pages へ配信する。

- プロジェクトページ配信のため `BASE_PATH=/<repo>/` を渡してビルドする（`vite.config.ts` の `base`）。
- SPA 直リンク用に `dist/index.html` を `dist/404.html` へ複製している。
- **パスをハードコードしない**。`import.meta.env.BASE_URL` を使う（`main.tsx` の basename、
  Service Worker の登録パスがその例）。

## PWA / オフライン

`public/sw.js` は本番ビルドでのみ登録される。アプリシェルはネットワーク優先 + キャッシュ fallback、
OpenStreetMap のタイルはキャッシュ優先。旅のデータは localStorage にあるので通信を必要としない。
キャッシュ内容を変えたら `VERSION` 定数を上げること（`activate` で古いキャッシュを消す作りになっている）。

## デモデータ

初回起動時は `lib/seedTrips.ts` が「進行中 / これから / 終わった」旅を 1 本ずつ作り、**即座に保存する**
（保存しないとリロードのたびに ID が変わり、URL 直リンクが壊れる）。
空状態を確認したいときは 設定 → DATA → すべて削除。

## 作業時の注意

- 変更後は `npm run lint` を必ず実行する（テストが無いぶん、型チェックが唯一の自動的な安全網）。
- 画面を足したら `app/App.tsx` のルートと、必要なら `features/trip/sections.ts` の
  セクション定義も更新する。README の画面表も合わせる。
- localStorage のスキーマを変えるときは、既存データが読める形にするか、マージで吸収する。
- コミットメッセージは日本語で、**何を・なぜ変えたか**を本文に書く（既存の履歴に倣う）。
  `git log` の直近数件がそのままお手本になる。
