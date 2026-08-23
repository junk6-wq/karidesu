---
name: passage-ui
description: PASSAGE（この旅アプリ）の画面・UI を追加したり手を入れたりするときに使う。新しい画面/ルート/セクションを足す、既存画面のレイアウトや導線を変える、共通コンポーネントやデザイントークンを触る、モード（PLAN / JOURNEY / MEMORY）の解禁条件や THE THREAD の見せ方を変える、といった作業で読む。src/features・src/components・src/styles・tailwind.config.js・src/app/App.tsx を編集する前に参照すること。
---

# PASSAGE の UI をつくる

このリポジトリは「旅を PLAN（作る）/ JOURNEY（生きる）/ MEMORY（遺す）の 3 幕として見せる」
という一点に全部の設計が従っている。UI を足すときは、機能として正しいだけでなく
**3 幕のどこに属し、THE THREAD にどうつながるか**を決めてから書く。

## 最初に確認する

| 目的 | コマンド |
| --- | --- |
| 型チェック（CI と同じ） | `npm run lint`（= `tsc --noEmit`） |
| 型チェック + 本番ビルド | `npm run build` |
| 開発サーバ | `npm run dev` |

`tsconfig.json` は `strict` に加えて `noUnusedLocals` / `noUnusedParameters` が有効。
使わない import・引数を残すと CI（`.github/workflows/deploy.yml` の Type check）で落ちる。
**変更を終えたら必ず `npm run lint` を通してからコミットする。**

インポートは必ずエイリアス `@/`（= `src/`）を使う。相対パスの `../../` は使わない。

## 守る 3 つのルール

1. **Brass Gold（`brass` / `--c-brass-gold`）は「進む・確定・希望」だけに使う。**
   金が出たら「次がある」という意味に全画面で統一されている。装飾目的で金を足さない。
   注意・危険は `brick`、中間状態（`at_risk`）だけ `amber`。
2. **色・フォント・角丸・影・イージングは必ずトークン経由で書く。**
   Tailwind のクラス（`bg-ink` `text-text-porcelain` `font-display` `rounded-card`
   `shadow-card` `ease-passage` `text-display-l` など）か CSS 変数を使い、
   生の HEX や任意の `px` 値をコンポーネントに直接書かない。
   新しい色が要ると思ったら、まず既存 5 色 + amber で表現できないかを疑う。
   本当に必要なら `src/styles/tokens.css` と `tailwind.config.js` の両方に足す。
3. **モーションは `prefers-reduced-motion` で必ず縮退する。**
   アニメーションは既存の `.anim-rise` / `.anim-fade` / `.anim-slide-down` /
   `.anim-mode-switch` を使う（`src/styles/index.css`）。独自に `@keyframes` を足す場合も
   reduced-motion ではクロスフェードのみになるようにする。

## 画面（Screen）を追加する手順

新しい画面を足すときに触るファイルは決まっている。**どれかを忘れると行き止まりが生まれる。**

1. `src/features/<mode>/XxxScreen.tsx` を作る（`plan` / `journey` / `memory` / `home` / `settings` / `wishlist`）。
2. `src/app/App.tsx` にルートを追加する。
   - Trip 配下の通常画面 → `<Route path="/trip/:id" element={<TripLayout />}>` の**内側**に置く。
     ヘッダー・モードタブ・セクションタブが自動で付く。
   - 没入表示にしたい画面（デッキ・共有など） → `TripLayout` の**外側**に置き、画面側で戻る導線を用意する。
3. `src/features/trip/sections.ts` の `sectionsFor()` にセクションを足す。
   ここに載せないと、その画面へは他画面のボタン頼みになり横移動できない。
   - `currentMode()`（`modes.ts`）はパスに `/journey` `/memory` が含まれるかでモードを判定する。
     セクションのパスがモード判定と食い違うと、タブが別モードへ飛ぶので注意。
   - JOURNEY は没入表示なのでセクションタブを持たない（導線は `JourneyScreen` 下部の操作バー）。
4. `README.md` の「画面」表に ID・画面名・ルートを追記する。
5. `npm run lint` を通す。

モードの解禁条件（出発日で JOURNEY、帰着日で MEMORY）を変えるときは `src/features/trip/modes.ts`。
ロック中のモードは必ず `lockedHint` で「次に何をすれば解禁されるか」を出す。

## 使い回す部品（新規に作る前にここを見る）

| 用途 | 使うもの |
| --- | --- |
| ボタン / リンクボタン | `@/components/common/Button`（`Button` / `LinkButton`、`variant`: primary・secondary・ghost・destructive、`tone`: light・dark） |
| ボトムシート | `@/components/common/Sheet` |
| 写真（スワイプ対応） | `@/components/common/Photo` |
| 数値の読み取り | `@/components/common/StatReadout` |
| タグ・チップ | `@/components/common/QuestChip` |
| 軌跡の線 | `@/components/thread/Thread`（`variant`: plan・journey・memory・locked、`progress`・`status`・`pulse`） |
| 地図 | `@/components/map/MapLayer`（Leaflet） |

ユーティリティクラス（`src/styles/index.css`）：
`.tap`（タッチターゲット 44px。押せる要素には必ず付ける）、
`.label-caps`（小さいラベル）、`.mono-readout`（等幅・タブular数値）。

`tone` の使い分けは背景で決まる：PLAN は明るい（`bg-stone` / `text-text-ink`）、
MEMORY と JOURNEY は暗い（`bg-ink` / `text-text-porcelain`）。
`TripLayout` は `active === 'memory'` で暗転するので、MEMORY 配下の画面は暗前提で書く。

安全領域は `pt-[max(12px,env(safe-area-inset-top))]` のように既存の書き方に合わせる。

## データを扱う

- 状態は Zustand：`@/store/tripsStore`・`journeyStore`・`wishlistStore`・`preferencesStore`。
  画面から直接 `localStorage` を触らない（`@/lib/storage/local` のラッパー経由で store が扱う）。
- ID は `@/lib/id` の `uid()`。日付・時刻は `@/lib/time`、表示整形は `@/lib/format`。
- AI と地図は `src/types/index.ts` の `AIAgentProvider` / `MapProvider` インターフェース越しにだけ使う
  （実体は `src/lib/providers/mockAgent.ts` / `localMap.ts` のモック）。
  画面が実装に直接依存すると、README の「差し替えポイント」が崩れる。
- 外部 API キーなしで動くことが前提。ネットワーク必須の実装を画面に持ち込まない
  （JOURNEY 中はオフラインでも開ける必要がある）。

## コメントの書き方

このリポジトリのコメントは「何をしているか」ではなく
**「なぜそうしたか／そうしないと何が起きたか」**を日本語で書く（`sections.ts` や `App.tsx` を見ればトーンが分かる）。
自明な処理にコメントを足さない。

## 仕上げのチェック

- [ ] `npm run lint` が通る
- [ ] 押せる要素に `.tap` が付き、フォーカスリングが消えていない
- [ ] 金色を「進む」以外の意味で使っていない
- [ ] 新しい画面なら App.tsx / sections.ts / README の 3 箇所を更新した
- [ ] 暗い背景の画面で `tone="dark"` を渡している
