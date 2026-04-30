# Drone Flight Sim — Phase 1

Photorealistic browser-based drone flight simulator built on Cesium and Google's
Photorealistic 3D Tiles (via Cesium ion). Built with Next.js 15 / React 19 /
TypeScript / MUI v7 / Resium / Three.js / Zustand.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Matches your default stack |
| 3D world | CesiumJS | Built-in geodetic math, terrain, time-dynamic sim |
| World data | Google Photorealistic 3D Tiles via Cesium ion | One call: `Cesium.createGooglePhotorealistic3DTileset()` |
| Drone model | Cesium Entity (box + arrow polyline) for now | Easy to swap for a glTF later |
| State | Zustand | Lightweight; stays out of Cesium's render loop |
| UI / HUD | MUI v7 | Per your stack preference |
| Three.js | Bundled, unused in Phase 1 | Reserved for prop-wash particles, custom shaders, advanced HUD-in-world |

## Setup

```bash
pnpm install     # or npm / yarn — `postinstall` copies Cesium static assets to /public/cesium
cp .env.local.example .env.local
# edit .env.local and set NEXT_PUBLIC_CESIUM_ION_TOKEN
pnpm dev
```

Open <http://localhost:3000>. The first load takes a few seconds while
Photorealistic 3D Tiles stream in around the spawn point (Tokyo Station).

To change spawn location, edit `SPAWN_LON / SPAWN_LAT / SPAWN_ALT` in
`src/lib/cesium-config.ts`.

## Controls

| Key | Action |
|---|---|
| `W` / `S` | Throttle up / down (sticky — release to hold) |
| `Space` | Throttle 100% (momentary) |
| `A` / `D` | Yaw left / right |
| `↑` / `↓` | Pitch forward / back |
| `←` / `→` | Roll left / right |
| `C` | Cycle camera (Chase → FPV → Free) |
| `R` | Reset to spawn |

In **Free** camera mode, Cesium's normal mouse drag/zoom is enabled, so you can
inspect the drone from any angle while it flies on autopilot input.

## Architecture

```
src/
├── app/                         Next.js App Router shell
├── components/
│   ├── Simulator.tsx            Cesium viewer + game loop + drone entity
│   └── HUD.tsx                  Aviation-style overlay (MUI)
├── lib/
│   ├── cesium-config.ts         Token, base URL, ENU helpers
│   ├── physics.ts               Quadcopter dynamics (angle-mode pitch/roll, rate yaw)
│   ├── input.ts                 Keyboard → ControlInput
│   └── camera-modes.ts          Chase / FPV / Free camera updates
└── store/
    └── sim-store.ts             Telemetry state (Zustand)
```

### Coordinate frames

The drone's authoritative state is in a **local ENU frame** anchored at the
spawn (East, North, Up — meters). On every tick we lift it into Cesium's ECEF
fixed frame via `Cesium.Transforms.eastNorthUpToFixedFrame(originCart)`. This
keeps the physics integrator numerically stable (small numbers) and avoids
fighting Cesium's geocentric math.

For long-range flight (>10 km from origin) you'll want to re-anchor the ENU
origin periodically — see Phase 2 below.

### Flight model

Self-leveling angle mode for pitch/roll, rate mode for yaw — matches how a
DJI-class consumer drone feels in stabilized mode. Default parameters in
`DEFAULT_PARAMS` are tuned to a ~900 g airframe with ~2.5:1 thrust-to-weight.
Tune to taste.

## Roadmap

**Phase 2 — make it feel like a drone**
- glTF drone model (with spinning rotors as separate nodes, animated by throttle)
- Prop-wash particles via Three.js overlay (camera-synced second canvas)
- Gamepad support (Xbox / PS / dedicated TX in Wireless mode)
- Audio: motor whine pitched by throttle, wind by airspeed
- Terrain-following ground collision (sample 3D Tiles via `viewer.scene.sampleHeightMostDetailed`)

**Phase 3 — make it useful for your platform**
- Mission editor: waypoint placement, KML/SHP import (now that Google Earth has
  SHP support, mission round-tripping is interesting)
- No-fly zones from a GeoJSON/SHP layer rendered as Cesium primitives
- Telemetry recording to a replayable trace (JSON or MAVLink-shaped)
- Multi-drone synchronization (WebSocket or WebRTC datachannel)
- AGL altitude (true above-ground-level) by sampling the Photorealistic tileset

**Phase 4 — production hardening**
- Re-anchor ENU origin at altitude/distance thresholds to avoid float drift
- Tile budget management (`maximumScreenSpaceError`) for low-end devices
- Cesium ion → direct Google Map Tiles API path to control billing
- Storybook stories for HUD components in isolation
- Visual regression on the HUD (Playwright + screenshot diff)

## Notes

- **Coverage**: Photorealistic 3D Tiles cover ~2,500 cities in 49 countries.
  Outside coverage you'll see the bare ellipsoid. For Japan rural / mountainous
  drone ops, blend in 国土地理院 DEM as a Cesium TerrainProvider in Phase 3.
- **Billing**: Going through Cesium ion bundles Google's 3D Tiles into your ion
  quota. If you have your own Google Maps Platform Map Tiles API key, you can
  hit Google directly via `Cesium.Cesium3DTileset.fromUrl(...)` — see the docs.
- **Attribution**: Production builds must show Google's required attribution.
  Re-enable `.cesium-widget-credits` in `globals.css` before shipping.
