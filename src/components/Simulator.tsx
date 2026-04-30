"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import {
  configureCesium,
  SPAWN_LON,
  SPAWN_LAT,
  SPAWN_ALT,
} from "@/lib/cesium-config";
import {
  createInitialState,
  stepPhysics,
  speedMps,
  groundSpeedMps,
  climbRateMps,
  headingDeg,
  DEFAULT_PARAMS,
  type ControlInput,
  type DroneState,
} from "@/lib/physics";
import {
  attachKeyboard,
  attachActionKeys,
  attachMouseControls,
  drainActions,
  drainWheel,
  hasUserMotionInput,
  readControl,
  type CameraMode,
} from "@/lib/input";
import { updateCamera, adjustChaseDistance } from "@/lib/camera-modes";
import { useSimStore } from "@/store/sim-store";
import { registerSimHandle, clearSimHandle } from "@/lib/sim-handle";
import { TOKYO_TOUR, type Landmark } from "@/lib/landmarks";

// Origin altitude is treated as sea level — drone position z is metres above
// that. The ENU origin moves with teleports so this stays a small offset.
const ORIGIN_ALT_SEA_LEVEL = 0;

// Go-here behaviour
const GOHERE_ARRIVE_HORIZ = 8;
const GOHERE_ARRIVE_VERT = 5;
const GOHERE_ALT_OFFSET = 60;

// Auto-tour
const TOUR_HOVER_MS = 6500;     // dwell at each landmark
const TOUR_CINEMA_YAW = 0.28;   // yaw rate (-1..1) — slow cinematic rotation

interface Origin {
  lon: number;
  lat: number;
}

export default function Simulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const stateRef = useRef<DroneState>(createInitialState(SPAWN_ALT));
  const originRef = useRef<Origin>({ lon: SPAWN_LON, lat: SPAWN_LAT });
  const cameraModeRef = useRef<CameraMode>("chase");
  const goHereRef = useRef<[number, number, number] | null>(null);
  const tourRef = useRef<{ index: number; arrivedAt: number } | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);

  const setTelemetry = useSimStore((s) => s.setTelemetry);
  const setCameraMode = useSimStore((s) => s.setCameraMode);
  const togglePause = useSimStore((s) => s.togglePause);
  const setTilesetReady = useSimStore((s) => s.setTilesetReady);
  const setTilesetError = useSimStore((s) => s.setTilesetError);
  const setTourState = useSimStore((s) => s.setTourState);
  const paused = useSimStore((s) => s.paused);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!containerRef.current) return;
    configureCesium();

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: false as unknown as Cesium.ImageryLayer,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    viewerRef.current = viewer;

    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.globe.enableLighting = true;

    // Photorealistic 3D Tiles
    setTilesetReady(false);
    setTilesetError(null);
    (async () => {
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset();
        viewer.scene.primitives.add(tileset);
        // Hide overlay once the first batch of tiles for the current view is on screen
        const onLoaded = () => {
          setTilesetReady(true);
          tileset.initialTilesLoaded.removeEventListener(onLoaded);
        };
        tileset.initialTilesLoaded.addEventListener(onLoaded);
      } catch (err) {
        console.error("[cesium] failed to load Photorealistic 3D Tiles:", err);
        setTilesetError(err instanceof Error ? err.message : String(err));
      }
    })();

    // ENU frame helper — recomputed from originRef each call so teleports
    // immediately re-anchor the local frame. Cheap (matrix construction).
    const enuAtOrigin = () => {
      const { lon, lat } = originRef.current;
      const cart = Cesium.Cartesian3.fromDegrees(lon, lat, ORIGIN_ALT_SEA_LEVEL);
      return Cesium.Transforms.eastNorthUpToFixedFrame(cart);
    };

    // --- Drone entity --------------------------------------------------------
    const positionProp = new Cesium.CallbackProperty(() => {
      const s = stateRef.current;
      return Cesium.Matrix4.multiplyByPoint(
        enuAtOrigin(),
        new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
        new Cesium.Cartesian3(),
      );
    }, false);

    const orientationProp = new Cesium.CallbackProperty(() => {
      const s = stateRef.current;
      const enu = enuAtOrigin();
      const pos = Cesium.Matrix4.multiplyByPoint(
        enu,
        new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
        new Cesium.Cartesian3(),
      );
      const hpr = new Cesium.HeadingPitchRoll(s.heading, s.pitch, s.roll);
      return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
    }, false);

    viewer.entities.add({
      name: "Drone",
      position: positionProp,
      orientation: orientationProp,
      box: {
        dimensions: new Cesium.Cartesian3(1.2, 1.2, 0.35),
        material: Cesium.Color.fromCssColorString("#22d3ee"),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const s = stateRef.current;
          const enu = enuAtOrigin();
          const tail = Cesium.Matrix4.multiplyByPoint(
            enu,
            new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
            new Cesium.Cartesian3(),
          );
          const cp = Math.cos(s.pitch);
          const fEast = Math.sin(s.heading) * cp;
          const fNorth = Math.cos(s.heading) * cp;
          const fUp = Math.sin(s.pitch);
          const tip = Cesium.Matrix4.multiplyByPoint(
            enu,
            new Cesium.Cartesian3(
              s.position[0] + fEast * 3,
              s.position[1] + fNorth * 3,
              s.position[2] + fUp * 3,
            ),
            new Cesium.Cartesian3(),
          );
          return [tail, tip];
        }, false),
        width: 4,
        material: Cesium.Color.fromCssColorString("#fde047"),
      },
    });

    // --- Teleport (used by Search and any future "fly to" command) -----------
    const teleport = (lon: number, lat: number, altitude: number) => {
      originRef.current = { lon, lat };
      stateRef.current = {
        ...stateRef.current,
        position: [0, 0, altitude],
        velocity: [0, 0, 0],
      };
      goHereRef.current = null;
    };

    // --- Auto tour ----------------------------------------------------------
    const goToLandmark = (lm: Landmark) => {
      teleport(lm.lon, lm.lat, lm.altitude);
      setTourState(true, lm.name);
    };

    const startTour = () => {
      if (TOKYO_TOUR.length === 0) return;
      tourRef.current = { index: 0, arrivedAt: performance.now() };
      goToLandmark(TOKYO_TOUR[0]);
    };

    const stopTour = () => {
      tourRef.current = null;
      setTourState(false, null);
    };

    registerSimHandle({ scene: viewer.scene, teleport, startTour, stopTour });

    // --- Input wiring --------------------------------------------------------
    const detachKeys = attachKeyboard();
    const detachActions = attachActionKeys();
    const detachMouse = attachMouseControls(viewer.canvas, {
      isActive: () => cameraModeRef.current !== "free",
      onDoubleClick: (clientX, clientY) => {
        const rect = viewer.canvas.getBoundingClientRect();
        const screen = new Cesium.Cartesian2(
          clientX - rect.left,
          clientY - rect.top,
        );
        const world = viewer.scene.pickPosition(screen);
        if (!world) return;
        const enuInv = Cesium.Matrix4.inverseTransformation(
          enuAtOrigin(),
          new Cesium.Matrix4(),
        );
        const local = Cesium.Matrix4.multiplyByPoint(
          enuInv,
          world,
          new Cesium.Cartesian3(),
        );
        goHereRef.current = [local.x, local.y, local.z + GOHERE_ALT_OFFSET];
      },
    });

    // --- Game loop -----------------------------------------------------------
    const tick = (now: number) => {
      const dtMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      const dt = Math.min(0.05, dtMs / 1000);

      for (const a of drainActions()) {
        if (a.cycleCamera) {
          const order: CameraMode[] = ["chase", "fpv", "free"];
          const next =
            order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
          cameraModeRef.current = next;
          setCameraMode(next);
          viewer.scene.screenSpaceCameraController.enableInputs =
            next === "free";
        }
        if (a.reset) {
          originRef.current = { lon: SPAWN_LON, lat: SPAWN_LAT };
          stateRef.current = createInitialState(SPAWN_ALT);
          goHereRef.current = null;
        }
        if (a.togglePause) togglePause();
      }

      const wheel = drainWheel();
      if (wheel !== 0) adjustChaseDistance(wheel);

      if (!pausedRef.current) {
        let input: ControlInput = readControl();

        // Auto tour: advance landmarks on a timer, override input with a
        // slow cinematic yaw. Any user motion key cancels the tour.
        if (tourRef.current) {
          if (hasUserMotionInput() || Math.abs(input.mouseYawRad) > 1e-4) {
            stopTour();
          } else {
            const elapsed = now - tourRef.current.arrivedAt;
            if (elapsed >= TOUR_HOVER_MS) {
              tourRef.current.index += 1;
              if (tourRef.current.index >= TOKYO_TOUR.length) {
                stopTour();
              } else {
                goToLandmark(TOKYO_TOUR[tourRef.current.index]);
                tourRef.current.arrivedAt = now;
              }
            }
            if (tourRef.current) {
              input = {
                forward: 0,
                vertical: 0,
                yawRate: TOUR_CINEMA_YAW,
                mouseYawRad: 0,
                boost: 1,
              };
            }
          }
        }

        if (goHereRef.current) {
          if (hasUserMotionInput() || Math.abs(input.mouseYawRad) > 1e-4) {
            goHereRef.current = null;
          } else {
            input = computeGoHereInput(stateRef.current, goHereRef.current);
            if (input === IDLE_INPUT) goHereRef.current = null;
          }
        }

        const next = stepPhysics(stateRef.current, input, DEFAULT_PARAMS, dt);
        stateRef.current = next;

        const intensity = Math.max(
          Math.abs(input.forward),
          Math.abs(input.vertical),
          Math.abs(input.yawRate),
        );
        setTelemetry({
          altitudeM: next.position[2],
          speedMps: speedMps(next),
          groundSpeedMps: groundSpeedMps(next),
          climbRateMps: climbRateMps(next),
          headingDeg: headingDeg(next),
          pitchDeg: (next.pitch * 180) / Math.PI,
          rollDeg: (next.roll * 180) / Math.PI,
          battery: next.battery,
          throttle: intensity * (input.boost > 1 ? 1 : intensity),
        });
      }

      updateCamera(viewer, cameraModeRef.current, stateRef.current, {
        lon: originRef.current.lon,
        lat: originRef.current.lat,
        altSeaLevel: ORIGIN_ALT_SEA_LEVEL,
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    viewer.scene.screenSpaceCameraController.enableInputs = false;

    return () => {
      cancelAnimationFrame(rafRef.current);
      detachKeys();
      detachActions();
      detachMouse();
      clearSimHandle();
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, background: "#000" }}
    />
  );
}

// --- Go-here helpers ---------------------------------------------------------

const IDLE_INPUT: ControlInput = {
  forward: 0,
  vertical: 0,
  yawRate: 0,
  mouseYawRad: 0,
  boost: 1,
};

function computeGoHereInput(
  s: DroneState,
  target: [number, number, number],
): ControlInput {
  const dE = target[0] - s.position[0];
  const dN = target[1] - s.position[1];
  const dU = target[2] - s.position[2];
  const horizDist = Math.sqrt(dE * dE + dN * dN);

  if (horizDist < GOHERE_ARRIVE_HORIZ && Math.abs(dU) < GOHERE_ARRIVE_VERT) {
    return IDLE_INPUT;
  }

  const targetHeading = Math.atan2(dE, dN);
  const headingDelta = wrapPi(targetHeading - s.heading);
  const yawRate = clamp(headingDelta / 0.6, -1, 1);

  const alignment = Math.cos(headingDelta);
  const forward =
    horizDist > GOHERE_ARRIVE_HORIZ ? Math.max(0, alignment) : 0;
  const vertical = clamp(dU / 12, -1, 1);

  return { forward, vertical, yawRate, mouseYawRad: 0, boost: 1 };
}

function wrapPi(rad: number): number {
  let r = rad;
  while (r > Math.PI) r -= 2 * Math.PI;
  while (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
