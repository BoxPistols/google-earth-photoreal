# 産業系ドローン計測アーキテクチャと拡張ロードマップ

## 0. このドキュメントの位置づけ

本リポジトリは出発点として **Google Photorealistic 3D Tiles のショーケース**(写実 3D 都市の上をドローン視点で飛行する体験デモ)を実装している。

ただし**最終目的は「ドローン産業系の計測」**であり、現状はそのアーキテクチャの**ごく一部(可視化レイヤの土台)**しか満たしていない。

このドキュメントは:

1. 産業計測アプリに必要なアーキテクチャ全体像
2. 各データレイヤの役割と入手元
3. 計測 / ミッション計画機能の整理
4. 日本特有のスタック(PLATEAU / 国土地理院 / DIPS 等)
5. **現状のこのアプリ ↔ 産業計測アプリのギャップと、優先度付き拡張ロードマップ**

を記録する。実装は今回のスプリントでは行わず、将来検討するためのリファレンスとする。

---

## 1. アーキテクチャ全体像

```
┌──────────────────────────────────────────────────────┐
│ 現場 (機体 + センサ)                                  │
│  RTK-GNSS / IMU / カメラ / LiDAR / マルチスペクトル    │
└───────────────┬──────────────────────────────────────┘
                │ 飛行ログ・撮影データ
                ▼
┌──────────────────────────────────────────────────────┐
│ 後処理パイプライン (オフライン / クラウド)              │
│  Photogrammetry  → Orthomosaic / DSM / DTM / Mesh    │
│  LiDAR processing → Point Cloud (.las/.laz)          │
│  ML: 異常検知 / 物体認識 / 進捗解析                    │
└───────────────┬──────────────────────────────────────┘
                │ アセット (3D Tiles / GeoTIFF / vector)
                ▼
┌──────────────────────────────────────────────────────┐
│ データレイヤ統合 (本リポジトリが触っているのはここ)     │
│ ─ 写実 3D メッシュ      Google Photorealistic 3D Tiles│
│ ─ 構造化 3D 都市        PLATEAU (CityGML→3D Tiles)    │
│ ─ 標高 (DEM/DTM)        Cesium World Terrain / GSI    │
│ ─ 写真オーバーレイ      Ortho GeoTIFF / WMTS          │
│ ─ ベクター              KML / GeoJSON / SHP           │
│ ─ 点群                  Cesium 3D Tiles (point cloud) │
│ ─ アセット属性           PLATEAU 属性 / 自社 DB        │
│ ─ 空域規制               DIPS / JCAB                  │
└───────────────┬──────────────────────────────────────┘
                │ Web レンダリング
                ▼
┌──────────────────────────────────────────────────────┐
│ 可視化・計測 UI (Web フロント)                         │
│  CesiumJS / Three.js / Mapbox GL                     │
│  ─ 距離 / 面積 / 体積 / 標高プロファイル               │
│  ─ AGL 表示 / 断面 / クリアランス                      │
│  ─ ミッション計画 (Waypoint / 自動経路 / Geofence)    │
│  ─ 時系列比較 (Before / After)                        │
└──────────────────────────────────────────────────────┘
```

---

## 2. データレイヤ別の役割

| レイヤ | 役割 | 入手元 | 形式 |
|---|---|---|---|
| **写実 3D メッシュ** | 周辺景観・全体像を「見せる」 | Google Maps Platform | 3D Tiles |
| **構造化 3D 都市** | 建物単位で属性を「拾う」(用途・高さ・築年) | **PLATEAU** | CityGML / 3D Tiles |
| **DEM / DTM** | AGL(対地高度)・地形追従・ビューシェッド | 国土地理院 / Cesium World Terrain | GeoTIFF / Quantized Mesh |
| **オーソ画像** | 撮影日の状況・進捗の正確な平面写像 | 自社撮影 → Pix4D / DroneDeploy / OpenDroneMap | GeoTIFF / Cloud Optimized GeoTIFF |
| **点群 (LiDAR)** | 高精度 3D 座標・体積計算・植生下の地形 | LiDAR センサ / Photogrammetry | LAS / LAZ → 3D Tiles |
| **空域規制** | 飛行可否判定 | DIPS / 国交省 / 自衛隊 | KML / SHP / GeoJSON |
| **アセット位置** | 検査対象 (鉄塔・パネル・橋脚) | 自社 DB / 顧客提供 | DB + GeoJSON エクスポート |

---

## 3. 計測機能(これがあると「計測アプリ」になる)

| 機能 | 何ができる | 必要な技術 |
|---|---|---|
| **距離計測** | クリック2点間の 3D 距離 | Cesium `pickPosition` × 2 + 距離算出 |
| **面積計測** | ポリゴン描画→水平/3D 表面積 | 三角形分割 + 球面三角法 |
| **体積計測** | 土量・盛土量 | 点群 / DSM の高さ差積分 |
| **標高プロファイル** | ライン沿いの地形断面 | `sampleHeightMostDetailed` をポリラインに沿って |
| **AGL 表示** | ドローン高度 − 地表高度 | 同上、毎フレーム |
| **クリアランス** | 機体から障害物までの距離 | Bullet / Cesium ray cast |
| **時系列比較** | 同じ場所の異なる撮影日を並べる | 複数 tileset の透明度切替 |
| **断面図** | 建物・地形の任意断面 | clipping plane |

---

## 4. ミッション計画(これがあると「業務アプリ」になる)

| 機能 | 役割 |
|---|---|
| **Waypoint editor** | クリックで飛行点列を作る |
| **AGL terrain follow** | 地形に追従して一定 AGL を保つ経路生成(DEM が必須) |
| **Geofence** | no-fly zone を回避する経路計算 |
| **エクスポート** | DJI WPML / KMZ / MAVLink / 自社プロトコル |
| **Pre-flight チェック** | 空域許可 / 天候 / バッテリ計算 |

---

## 5. 日本特有のスタック

| 項目 | 内容 |
|---|---|
| **DIPS** | 国交省「ドローン情報基盤システム」— 機体登録・飛行申請 |
| **PLATEAU** | 国交省 3D 都市モデル(LOD 1〜4)— 属性付き建物 |
| **国土地理院 (GSI)** | 標高タイル(DEM 5m/10m)・地形図タイル |
| **CSV** | Cyber Smart Village 自治体スマートシティ実証データ |
| **JUTM** | 日本版 UTM(Unmanned Traffic Management)枠組み |

---

## 6. 現状アプリ ↔ 産業計測アプリのギャップ

### 現状(2026-05 時点)で**できていること**

- Google Photorealistic 3D Tiles 上の自由飛行視点
- Cesium ion ジオコーダ経由のキーワード検索 → cinematic fly-to
- 都市ランドマーク自動巡回ツアー
- マウス操作によるピン → 確認 → 飛行
- 操縦体験 UI(WASD / 矢印 / マウス、ブースト、計器 HUD、一時停止)

### 産業計測に必要だが**できていないこと**

| カテゴリ | 不足機能 |
|---|---|
| 計測 | 距離 / 面積 / 体積 / 標高プロファイル / クリアランス / 断面 / **時系列比較** |
| 地形 | DEM(現在は `EllipsoidTerrainProvider`、平らな地球。AGL が意味を持たない) |
| 属性 | PLATEAU・自社 DB の建物/設備属性ピック |
| ミッション | Waypoint editor / AGL terrain follow / Geofence / DJI WPML エクスポート |
| 規制 | DIPS 空域オーバーレイ / no-fly zone 自動チェック |
| センサ統合 | オーソ画像オーバーレイ / 点群(LAS / 3D Tiles) |
| アセット管理 | 検査対象 DB 連携 / 過去結果の差分表示 |

---

## 7. 優先度付き拡張ロードマップ

各機能のタイムボックスは「最小実装」を想定。本格対応はその数倍。

### Phase A: 計測ベースマップ化(★★★ — 最優先 / 数時間)

1. **`terrainProvider` を `Cesium.createWorldTerrainAsync()` に切替** — 山間部や河川敷で本物の地形が出るように
2. **HUD に AGL(対地高度)を追加** — `scene.sampleHeight(cartographic)` で地表高度を取得し `altitude - groundAlt`
3. **クリック 2 点で距離計測** — 既存の click→pin UI を拡張、ライン + 数値表示

これだけで「景観飛行アプリ」→「**計測ベースマップ + 飛行視点プレビュー**」に格上がる。

### Phase B: 規制・属性レイヤ(★★ — デモ価値高)

4. **PLATEAU トグル** — 同位置を Google 写実版と PLATEAU 構造化版で切替表示。クリックで属性ポップアップ
5. **DIPS / no-fly zone GeoJSON 重畳** — 半透明シリンダーで空域可視化
6. **GSI(国土地理院)タイル切替** — 地形図 / 航空写真フォールバック

### Phase C: 計測の本格化(★★ — 業務化への分水嶺)

7. **面積計測**(ポリゴン描画 + 表面積)
8. **標高プロファイル**(ライン → 断面グラフ)
9. **複数 3D Tileset 同時表示**(オーソ / 点群 / 過去撮影)
10. **時系列比較スライダ**(Before/After)

### Phase D: ミッション計画(★ — 業務アプリ化)

11. **Waypoint editor**(クリックで点列、ドラッグで並べ替え)
12. **AGL terrain follow 経路生成**(DEM ベース)
13. **DJI WPML / KMZ エクスポート**
14. **Geofence(空域回避)**

### Phase E: センサ・点群(★ — 重案件向け)

15. **LAS / LAZ ロード**(`Cesium3DTileset` で点群配信)
16. **オーソ GeoTIFF オーバーレイ**(WMTS or Cesium ImageryProvider)
17. **マルチスペクトル / NDVI 表示**

### Phase F: 業務基盤(必要に応じて)

18. **認証 / RBAC**(Auth0 / Cognito)
19. **アセット DB 連携**(検査対象台帳)
20. **検査結果の差分管理**(時系列の保存・比較)
21. **モバイル対応 / オフライン**(現場タブレット運用)

---

## 8. 実装上のメモ

### Cesium World Terrain への切替

```ts
// src/components/Simulator.tsx
const viewer = new Cesium.Viewer(containerRef.current, {
  // 旧: terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  terrainProvider: await Cesium.createWorldTerrainAsync(),
  // 残りは現状維持
});
```

### AGL 表示

```ts
// 毎フレーム or 250ms 間隔
const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, droneAlt);
const groundCarto = Cesium.Cartographic.fromCartesian(cartesian);
groundCarto.height = 0;
const sampled = viewer.scene.sampleHeight(groundCarto);
const agl = droneAlt - (sampled ?? 0);
```

### PLATEAU タイルセットのロード

PLATEAU は 3D Tiles 形式で配信されている。例:

```ts
const plateauTileset = await Cesium.Cesium3DTileset.fromUrl(
  "https://assets.cms.plateau.reearth.io/.../tileset.json"
);
viewer.scene.primitives.add(plateauTileset);
plateauTileset.show = false; // トグルで切替
```

属性ピック:

```ts
const picked = viewer.scene.pick(screenPos);
if (picked instanceof Cesium.Cesium3DTileFeature) {
  const usage = picked.getProperty("用途");
  const height = picked.getProperty("計測高さ");
  // ポップアップ表示
}
```

### DIPS 空域データ

DIPS は KML / SHP で空域データを公開している。Cesium は KML / GeoJSON を直接ロード可:

```ts
const noFlyZones = await Cesium.GeoJsonDataSource.load(
  "/data/no-fly-zones.geojson",
  { fill: Cesium.Color.RED.withAlpha(0.15), stroke: Cesium.Color.RED }
);
viewer.dataSources.add(noFlyZones);
```

SHP は事前変換が必要(`shapefile-to-geojson` 等)。

### 点群 (LAS / LAZ)

CesiumJS は `Cesium3DTileset` で点群形式を直接扱える(事前に LAS → 3D Tiles 変換が必要)。変換ツールは `cesium-ion CLI` / `entwine` / `PDAL`。

---

## 9. 参考リンク

- Google Photorealistic 3D Tiles: https://developers.google.com/maps/documentation/tile/3d-tiles
- Cesium ion: https://cesium.com/platform/cesium-ion/
- PLATEAU: https://www.mlit.go.jp/plateau/
- 国土地理院 標高タイル: https://maps.gsi.go.jp/development/elevation_tile.html
- DIPS(ドローン情報基盤システム): https://www.dips.mlit.go.jp/
- OpenDroneMap: https://www.opendronemap.org/
- 3D Tiles 仕様 (OGC): https://www.ogc.org/standard/3dtiles/

---

## 10. このドキュメントの更新方針

- 機能を実装したら「6. 現状アプリ」のチェックリストを更新する
- 新たに採用したサービス / 技術が出たら「2. データレイヤ別」「5. 日本特有のスタック」に追記
- 実装方針が変わったら「7. 優先度付き拡張ロードマップ」を再評価
