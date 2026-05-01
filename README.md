# Drone Flight Sim — Photorealistic 3D Tiles + 産業計測ベースマップ

Cesium + Google Photorealistic 3D Tiles の上をドローン視点で飛ぶブラウザアプリ。  
最終目的は **ドローン産業系の計測ベースマップ** で、現状はその可視化基盤のショーケース。

**🌍 Live demo:** <https://boxpistols.github.io/google-earth-photoreal/>

---

## ハンドオーバ / 開発再開手順

別 PC や将来の自分が再開するときは **必ず先に [`docs/handover.md`](./docs/handover.md)** を読むこと。
セットアップ手順、現状のスナップショット、既知の課題、次にやるべき項目までまとまっている。

---

## このリポジトリの位置づけ

主目的:**ドローン産業計測アプリのプロトタイプ基盤**(全体像は [`docs/industrial-roadmap.md`](./docs/industrial-roadmap.md))

現状実装:**写実 3D 都市の上を飛行 + 検索 + 自動ツアー + クリックピン** — ロードマップで言う「可視化レイヤ + UX」のみ
未実装:計測機能 / 地形プロバイダ / PLATEAU / 空域 / オーソ / 点群

「これは産業計測アプリのどの Phase に当たるか」を意識すること。

---

## クイックスタート

```bash
pnpm install                          # postinstall で /public/cesium にアセット展開
cp .env.local.example .env.local      # NEXT_PUBLIC_CESIUM_ION_TOKEN を埋める
pnpm dev                              # http://localhost:3333
```

Cesium ion トークンは <https://ion.cesium.com/tokens> で取得。

---

## 操作

| キー / マウス | 動作 |
|---|---|
| `W` `A` `S` `D` または 矢印キー | 前後・左右旋回 |
| `Q` / `Space` | 上昇 |
| `E` / `Ctrl` | 下降 |
| `Shift` | ブースト ×2.5 |
| `C` | カメラ切替 (Chase / FPV / Free) |
| `R` | リセット |
| `Esc` | 一時停止 |
| `⌘K` / `Ctrl+K` | 検索ボックスにフォーカス |
| 検索ボックス Enter | 280ms 待って検索(IME 安全) |
| 検索ボックス `⌘+Enter` | 即時検索 |
| マウス左ドラッグ | カメラヨー |
| マウスホイール | チェイス距離 |
| シングルクリック | ピン → 「ここへ移動」確認 |

---

## 技術スタック

| Layer | 採用 | 役割 |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR-disabled の static export |
| 3D Engine | CesiumJS 1.140 | 測地系 / 3D Tiles / カメラ |
| World data | Google Photorealistic 3D Tiles via Cesium ion | `Cesium.createGooglePhotorealistic3DTileset()` |
| Geocoder | Cesium ion (Bing 経由) | キーワード検索 |
| State | Zustand | UI / sim 状態 |
| UI | MUI v7 | HUD / 検索 / ツアーパネル |
| Deploy | GitHub Pages + Actions | main push で自動デプロイ |

---

## アーキテクチャ概要

```
src/
├── app/                  Next.js shell + metadata + manifest + OG image
├── components/
│   ├── Simulator.tsx     Cesium viewer + ゲームループ + ツアー / 検索 / ピン
│   ├── HUD.tsx           計器パネル
│   ├── SearchBox.tsx     検索 + autocomplete + 履歴 + Cmd+K + IME 対応
│   ├── TourPanel.tsx     自動ツアー
│   ├── PinConfirm.tsx    クリックピンの「ここへ移動」吹き出し
│   ├── LoadingOverlay.tsx タイル取得中のオーバーレイ
│   └── UpdateBanner.tsx  新デプロイ検出バナー
├── lib/
│   ├── cesium-config.ts
│   ├── physics.ts        アーケード型運動モデル(指数追従、重力なし)
│   ├── input.ts          IME 安全なキー入力
│   ├── camera-modes.ts   Chase / FPV / Free
│   ├── landmarks.ts      ツアーランドマーク座標
│   ├── sim-handle.ts     コンポーネント間呼び出しシングルトン
│   └── os.ts             OS 判定 / ⌘ vs Ctrl
└── store/sim-store.ts    Zustand state
```

詳細は [`docs/handover.md`](./docs/handover.md) のファイルマップ。

---

## ドキュメント

- [`docs/handover.md`](./docs/handover.md) — **再開ハンドオーバ**(まずこれ)
- [`docs/industrial-roadmap.md`](./docs/industrial-roadmap.md) — 産業計測アプリ化のアーキテクチャと Phase A〜F ロードマップ

---

## ライセンス・権利関係

- **Google Photorealistic 3D Tiles**: 商用配信時は Google 必須 attribution を表示する必要あり (`globals.css` の `.cesium-widget-credits` 非表示を解除)
- **Cesium ion トークン**: NEXT_PUBLIC_ なのでデプロイバンドルに埋め込まれる前提。本番運用時は **トークンを domain allowlist** で制限する
- **Cesium ion クレジット**: 検索 / 3D Tiles 表示で消費。デモ用途では誤差レベルだが、長時間放置や多数視聴で増える点に注意
