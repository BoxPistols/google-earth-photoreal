# 開発再開ハンドオーバ

このリポジトリの開発を一時停止する時点でのスナップショット。別 PC や将来の自分が再開するときの最短パスをまとめる。

最終更新: **2026-05-01** / 最終コミット: `375316c`

---

## 1. 一発で見るデモ

**🌍 https://boxpistols.github.io/google-earth-photoreal/**

GitHub Actions で main の push ごとに自動デプロイされる。タイル取得に数秒、その後ローディングオーバーレイが消えて操作可能になる。

---

## 2. 新しい PC でのセットアップ

### 2.1 必要なもの

| ツール | バージョン |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ (`npm i -g pnpm@9` で OK) |
| Cesium ion アクセストークン | https://ion.cesium.com/tokens で取得 |
| GitHub アカウント | BoxPistols (push 権限) |

### 2.2 手順

```bash
git clone git@github.com:BoxPistols/google-earth-photoreal.git
cd google-earth-photoreal
pnpm install                          # postinstall で /public/cesium にアセット展開
cp .env.local.example .env.local
# .env.local を開いて NEXT_PUBLIC_CESIUM_ION_TOKEN= に自分のトークン
pnpm dev
```

ブラウザで **http://localhost:3333** を開く(既定の 3000 ではなく **3333**)。

### 2.3 GitHub Pages 側の状態

- リポジトリは **Public**
- Pages 有効化済み (build_type: workflow)
- Secrets に `NEXT_PUBLIC_CESIUM_ION_TOKEN` 登録済み(別 PC からも push 即デプロイで動く)
- `gh auth login` で `BoxPistols` にログインしてあれば push 可能

---

## 3. 開発・デプロイのフロー

### 3.1 通常のローカル開発

```bash
pnpm dev               # localhost:3333
```

### 3.2 ビルド検証

```bash
NEXT_PUBLIC_BASE_PATH=/google-earth-photoreal pnpm build
# → out/ に static export
# → out/_next/static/chunks/*.js に octal-escape fix が適用される
# → out/build-info.json が生成される
```

### 3.3 デプロイ

`main` に push するだけ。`.github/workflows/deploy.yml` が:

1. `pnpm install --frozen-lockfile`
2. `pnpm run build`(= `next build && fix-octal-escapes && write-build-info`)
3. `out/` を Pages にアップロード
4. `actions/deploy-pages@v4` で公開

ワークフロー: https://github.com/BoxPistols/google-earth-photoreal/actions

---

## 4. 現状のスナップショット

### 4.1 動いている機能

| カテゴリ | 機能 |
|---|---|
| **ベース** | Google Photorealistic 3D Tiles 上の自由飛行 |
| **物理** | アーケード型運動モデル(指数追従、重力なし、入力ゼロでホバー) |
| **操作** | WASD / 矢印キー(前後・旋回)、Q/Space(上昇)、E/Ctrl(下降)、Shift(×2.5 ブースト) |
| **マウス** | 左ドラッグ=ヨー、ホイール=チェイス距離、シングルクリック=ピン+確認 |
| **検索** | 左上に検索ボックス、Cmd/Ctrl+K でフォーカス、IME 安全(280ms 遅延 + 変換中無視)、Cmd+Enter で即時、6 件オートコンプリート、LocalStorage 履歴 |
| **テレポート** | 検索/クリックで cinematic 弧型飛行(5〜14秒、距離に応じる)、ENU 原点を着地時に再固定 |
| **ツアー** | 「自動ツアー開始」ボタンで東京 7 ランドマークを順次飛行(東京駅→皇居→東京タワー→国立競技場→新宿→渋谷→スカイツリー)。任意キーで中断 |
| **HUD** | 視認性の高いダーク半透明パネル + 計器ラベル(HEADING/ATTITUDE/GS/ALT/THR/BAT)、ホバーツールチップ |
| **カメラ** | Chase / FPV / Free 切替(C キー)、orthonormal 基底で安定 |
| **PWA** | manifest.webmanifest、icon.svg、apple-icon.svg、OpenGraph image |
| **更新通知** | 新しい build-info.json を 30 秒間隔で polling、変更検出でリロードバナー |
| **エラー対策** | Cesium WASM glue の `\00` octal を `\xNN` に置換するポストビルド、IME 中の操作キー無効化 |

### 4.2 やってないこと(産業計測アプリ化のため重要)

詳細は `docs/industrial-roadmap.md` Phase A〜F 参照。**未着手の優先度高い項目**:

- **`terrainProvider` を `Cesium.createWorldTerrainAsync()` に切替**(現在は `EllipsoidTerrainProvider` で平らな地球)
- **AGL(対地高度)表示**(`scene.sampleHeight` で地表高取得)
- **距離計測**(クリック 2 点)
- **PLATEAU トグル**(同位置を Google 写実版と PLATEAU 構造化版で切替)
- **DIPS 空域オーバーレイ**(no-fly zone の GeoJSON 重畳)
- **3D ドローンモデル**(現在はシアン箱、4ローター procedural にする案あり)
- **標高プロファイルチャート**(画面下に飛行軌跡の高度トレース)
- **オーソ画像オーバーレイ**(過去撮影の重畳・時系列比較)

---

## 5. 既知の課題 / Known Issues

| 課題 | 影響 | 対応案 |
|---|---|---|
| Node.js 20 deprecation warning(Actions) | 2026年6月以降ワークフロー警告 | actions/checkout 等を Node 24 対応版に上げる |
| 検索が遠距離(NY/パリ等)でも動くが地形精度は Tokyo 中心 | 全世界対応は ENU 再固定で解決済 | OK |
| `pendingPin` の screen 座標はクリック時固定。カメラ移動で見当外れに | UX 低下 | 毎フレーム world→screen 変換するか、移動検知で自動 dismiss |
| `goHere` 機構がコードに残るが UI から起動不可 | デッドコード | `Simulator.tsx` から削除 or 将来活用 |
| `viewer.scene.skyAtmosphere` 等の TS エラー(pre-existing) | next.config で `ignoreBuildErrors: true` で回避 | Cesium 1.124 で型がもう少し綺麗になっている可能性 |
| dev server で `/build-info.json` が 404 | ローカルで UpdateBanner が無音で諦める。動作上問題なし | 開発時専用のフォールバック(初回 fetch 失敗で polling 停止)は実装済 |

---

## 6. ファイルマップ

```
.
├── .github/workflows/
│   └── deploy.yml                  GitHub Pages 自動デプロイ
├── docs/
│   ├── handover.md                 ★このファイル
│   └── industrial-roadmap.md       産業計測アプリ化の全体構想
├── public/cesium/                  Cesium runtime assets (postinstall で生成 / gitignore)
├── scripts/
│   ├── copy-cesium-assets.mjs      pnpm install 後に Cesium のアセットを public/ にコピー
│   ├── fix-octal-escapes.mjs       ポストビルドで Cesium の WASM glue 内 \00 を \xNN に
│   └── write-build-info.mjs        build-info.json を生成
├── src/
│   ├── app/
│   │   ├── layout.tsx              metadata, viewport, OG, manifest 参照
│   │   ├── manifest.ts             PWA manifest (basePath 対応)
│   │   ├── opengraph-image.tsx     1200x630 の OG 画像生成
│   │   ├── icon.svg                ファビコン (Next.js 自動 link)
│   │   ├── apple-icon.svg          Apple touch icon
│   │   └── page.tsx                エントリポイント (全コンポーネントを mount)
│   ├── components/
│   │   ├── Simulator.tsx           Cesium viewer + ゲームループ + ドローン entity + ツアー / 検索 fly leg / クリックピンの全部
│   │   ├── HUD.tsx                 計器パネル(視認性 + ラベル + Tooltip)
│   │   ├── SearchBox.tsx           検索 + autocomplete + 履歴 + Cmd+K + IME 対応
│   │   ├── TourPanel.tsx           ツアー開始 / 停止ボタン
│   │   ├── PinConfirm.tsx          クリックピンの「ここへ移動」吹き出し
│   │   ├── LoadingOverlay.tsx      初回タイル取得中の全画面オーバーレイ
│   │   └── UpdateBanner.tsx        新デプロイ検出 + リロード誘導
│   ├── lib/
│   │   ├── cesium-config.ts        Cesium token / base URL / SPAWN 座標
│   │   ├── physics.ts              アーケード運動モデル
│   │   ├── input.ts                キーボード/マウス入力(IME 安全な isTypingTarget)
│   │   ├── camera-modes.ts         Chase / FPV / Free + orthonormal lookAt
│   │   ├── landmarks.ts            ツアーのランドマーク座標
│   │   ├── sim-handle.ts           Simulator → 他コンポーネント呼び出し用シングルトン
│   │   └── os.ts                   OS 判定 / ⌘ vs Ctrl / IME 検出
│   └── store/
│       └── sim-store.ts            Zustand state (telemetry, tour, pin, tileset 状態など)
├── .env.local.example              トークン埋めるテンプレ
├── .gitignore                      node_modules / .next / .env.local / public/cesium 等
├── next.config.mjs                 output:'export', basePath, trailingSlash 等
├── package.json                    build = next build && fix-octal-escapes && write-build-info
└── tsconfig.json
```

---

## 7. 再開時のおすすめ着手順

### A. すぐ動かしたい

1. README の「Setup」通りに `pnpm install && pnpm dev`
2. http://localhost:3333 を開く
3. 主要操作を試す: WASD / 検索ボックス / 自動ツアー / シングルクリック→ピン

### B. 機能追加したい

`docs/industrial-roadmap.md` を開いて Phase A の 3 項目から:

1. `terrainProvider` を `createWorldTerrainAsync()` に切替(`Simulator.tsx` 1 行)
2. HUD に `AGL` 表示(`scene.sampleHeight` を毎フレームで)
3. 距離計測ツール(クリック 2 点)

これだけで「景観飛行アプリ」→「**計測ベースマップ**」に格上がる。

### C. デモ向け表現を磨きたい

- 3D ドローンモデル(現在は単純な箱)
- ツアーのカメラワーク改善(現在は drone fly leg のみ)
- オンボーディング(初回起動時の操作チュートリアル)

詳細は `docs/industrial-roadmap.md` の Phase B〜F。

---

## 8. 主旨を忘れないために

このアプリの最終目的は **ドローン産業系の計測** である。Google Photorealistic 3D Tiles はその基盤の **可視化レイヤの一部**にすぎない。

機能追加判断のたびに `docs/industrial-roadmap.md` の Phase 表に照らして、それが Phase A〜F のどれに当たるかを意識すれば、デモ向け装飾と業務化のバランスを保ちやすい。

---

## 9. 参考ドキュメント

- [docs/industrial-roadmap.md](./industrial-roadmap.md) — 産業計測アプリのアーキテクチャ全体像と Phase 別ロードマップ
- [README.md](../README.md) — リポジトリ概要 + setup
- 過去の commit log — `git log --oneline` で各機能追加の経緯がわかる(コミットメッセージは説明的に書いてあるので grep しやすい)

---

## 10. 連絡先 / 引き継ぎ事項

- リポジトリオーナー: BoxPistols (https://github.com/BoxPistols)
- Cesium ion トークン: 個人アカウント発行(別 PC で同じトークンを `.env.local` に書けば動く)
- GitHub Secret `NEXT_PUBLIC_CESIUM_ION_TOKEN` は 2026-05-01 06:12 UTC 登録、Cesium ion が別トークンを発行するまで再設定不要
