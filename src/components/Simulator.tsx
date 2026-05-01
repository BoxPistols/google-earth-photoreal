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
  drainMouseYawSilent,
  drainWheel,
  hasUserMotionInput,
  peekMouseYaw,
  readControl,
  type CameraMode,
} from "@/lib/input";
import { updateCamera, adjustChaseDistance } from "@/lib/camera-modes";
import { useSimStore } from "@/store/sim-store";
import { registerSimHandle, clearSimHandle } from "@/lib/sim-handle";
import { TOKYO_TOUR } from "@/lib/landmarks";

interface FlightLeg {
  startTime: number;
  duration: number; // ms
  fromLocal: [number, number, number];
  toLocal: [number, number, number];
  arcLift: number; // m above straight-line midpoint
  toLLA: { lon: number; lat: number; alt: number };
  onArrive?: () => void;
}

// Origin altitude is treated as sea level — drone position z is metres above
// that. The ENU origin moves with teleports so this stays a small offset.
const ORIGIN_ALT_SEA_LEVEL = 0;

// Go-here behaviour
const GOHERE_ARRIVE_HORIZ = 8;
const GOHERE_ARRIVE_VERT = 5;
const GOHERE_ALT_OFFSET = 60;

// Auto-tour: each landmark visit = brief hover then smooth fly to next.
const TOUR_HOVER_MS = 2500;            // dwell time at each landmark, ms
const TOUR_LEG_MIN_MS = 5000;          // leg duration floor
const TOUR_LEG_MAX_MS = 14000;         // leg duration ceiling
const TOUR_LEG_SPEED = 1200;           // m/s used to size leg duration
const TOUR_LEG_PITCH = -0.12;          // ~7° nose-down lean while cruising
const TOUR_LEG_ARC_FRACTION = 0.15;    // mid-leg lift = 15% of horizontal dist…
const TOUR_LEG_ARC_MAX = 800;          // …capped at 800 m

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
  const flightLegRef = useRef<FlightLeg | null>(null);
  const tourRef = useRef<{
    phase: "flying" | "hovering";
    idx: number;
    phaseStart: number;
    phaseDuration: number;
  } | null>(null);
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

    // --- Teleport (instant; used internally) --------------------------------
    const teleport = (lon: number, lat: number, altitude: number) => {
      originRef.current = { lon, lat };
      stateRef.current = {
        ...stateRef.current,
        position: [0, 0, altitude],
        velocity: [0, 0, 0],
      };
      goHereRef.current = null;
      flightLegRef.current = null;
    };

    // --- Cinematic flight leg builder ---------------------------------------
    // Stores everything in the *current* ENU frame; on arrival the origin is
    // re-anchored to (lon, lat) so precision stays sharp at the destination.
    const buildLeg = (
      lon: number,
      lat: number,
      altitude: number,
      onArrive?: () => void,
    ): FlightLeg => {
      const enuFrame = enuAtOrigin();
      const enuInv = Cesium.Matrix4.inverseTransformation(
        enuFrame,
        new Cesium.Matrix4(),
      );
      const toCart = Cesium.Cartesian3.fromDegrees(lon, lat, altitude);
      const toLocal = Cesium.Matrix4.multiplyByPoint(
        enuInv,
        toCart,
        new Cesium.Cartesian3(),
      );

      const fromPos = stateRef.current.position;
      const dx = toLocal.x - fromPos[0];
      const dy = toLocal.y - fromPos[1];
      const horizDist = Math.sqrt(dx * dx + dy * dy);

      const duration = clamp(
        (horizDist / TOUR_LEG_SPEED) * 1000,
        TOUR_LEG_MIN_MS,
        TOUR_LEG_MAX_MS,
      );
      const arcLift = clamp(
        horizDist * TOUR_LEG_ARC_FRACTION,
        150,
        TOUR_LEG_ARC_MAX,
      );

      return {
        startTime: performance.now(),
        duration,
        fromLocal: [fromPos[0], fromPos[1], fromPos[2]],
        toLocal: [toLocal.x, toLocal.y, toLocal.z],
        arcLift,
        toLLA: { lon, lat, alt: altitude },
        onArrive,
      };
    };

    // --- Cinematic search fly (used by SearchBox and external callers) ------
    const flyTo = (lon: number, lat: number, altitude: number) => {
      // Cancel any active tour or go-here when the user invokes a manual fly.
      stopTour();
      goHereRef.current = null;
      flightLegRef.current = buildLeg(lon, lat, altitude);
    };

    // --- Auto tour ----------------------------------------------------------
    const TOUR_INTRO_MS = 1500; // brief pause after the initial snap
    function startTour() {
      if (TOKYO_TOUR.length === 0) return;
      const first = TOKYO_TOUR[0];
      teleport(first.lon, first.lat, first.altitude);
      tourRef.current = {
        phase: "hovering",
        idx: 0,
        phaseStart: performance.now(),
        phaseDuration: TOUR_INTRO_MS,
      };
      setTourState(true, first.name);
    }

    function stopTour() {
      tourRef.current = null;
      flightLegRef.current = null;
      setTourState(false, null);
    }

    const tourFlyToIndex = (idx: number) => {
      const lm = TOKYO_TOUR[idx];
      flightLegRef.current = buildLeg(lm.lon, lm.lat, lm.altitude, () => {
        // On arrival: switch tour to hovering for a beat, then advance.
        tourRef.current = {
          phase: "hovering",
          idx,
          phaseStart: performance.now(),
          phaseDuration: TOUR_HOVER_MS,
        };
        setTourState(true, lm.name);
      });
      tourRef.current = {
        phase: "flying",
        idx,
        phaseStart: performance.now(),
        phaseDuration: flightLegRef.current.duration,
      };
      setTourState(true, `→ ${lm.name}`);
    };

    registerSimHandle({
      scene: viewer.scene,
      teleport,
      flyTo,
      startTour,
      stopTour,
    });

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
        // User input cancels any cinematic playback (tour or fly-to).
        const userInterrupt =
          hasUserMotionInput() || Math.abs(peekMouseYaw()) > 1e-4;
        if (userInterrupt) {
          if (tourRef.current) stopTour();
          if (flightLegRef.current && !tourRef.current) {
            flightLegRef.current = null;
          }
        }

        // Tour state machine: drives flight legs on a timer.
        if (tourRef.current && tourRef.current.phase === "hovering") {
          const elapsed = now - tourRef.current.phaseStart;
          if (elapsed >= tourRef.current.phaseDuration) {
            const nextIdx = tourRef.current.idx + 1;
            if (nextIdx >= TOKYO_TOUR.length) {
              stopTour();
            } else {
              tourFlyToIndex(nextIdx);
            }
          }
        }

        // Process active flight leg (cinematic interpolation, bypasses physics).
        let cinematic = false;
        if (flightLegRef.current) {
          const leg = flightLegRef.current;
          const tNorm = Math.min(1, (now - leg.startTime) / leg.duration);
          const e = easeInOut(tNorm);
          const x = lerp(leg.fromLocal[0], leg.toLocal[0], e);
          const y = lerp(leg.fromLocal[1], leg.toLocal[1], e);
          const baseZ = lerp(leg.fromLocal[2], leg.toLocal[2], e);
          const arcZ = baseZ + Math.sin(tNorm * Math.PI) * leg.arcLift;

          const dx = leg.toLocal[0] - leg.fromLocal[0];
          const dy = leg.toLocal[1] - leg.fromLocal[1];
          const heading =
            dx * dx + dy * dy > 1 ? Math.atan2(dx, dy) : stateRef.current.heading;

          stateRef.current = {
            ...stateRef.current,
            position: [x, y, arcZ],
            velocity: [0, 0, 0],
            heading,
            pitch: TOUR_LEG_PITCH,
            roll: 0,
          };
          cinematic = true;

          if (tNorm >= 1) {
            // Arrived: re-anchor origin to destination so precision stays sharp.
            originRef.current = { lon: leg.toLLA.lon, lat: leg.toLLA.lat };
            stateRef.current = {
              ...stateRef.current,
              position: [0, 0, leg.toLLA.alt],
              pitch: 0,
              roll: 0,
            };
            const onArrive = leg.onArrive;
            flightLegRef.current = null;
            if (onArrive) onArrive();
          }
        }

        let input: ControlInput | null = null;
        if (!cinematic) {
          input = readControl();

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
        } else {
          // Drain mouseYaw accumulator so it doesn't pile up during tour.
          drainMouseYawSilent();
        }

        const intensity = input
          ? Math.max(
              Math.abs(input.forward),
              Math.abs(input.vertical),
              Math.abs(input.yawRate),
            )
          : 1;
        const next = stateRef.current;
        setTelemetry({
          altitudeM: next.position[2],
          speedMps: speedMps(next),
          groundSpeedMps: groundSpeedMps(next),
          climbRateMps: climbRateMps(next),
          headingDeg: headingDeg(next),
          pitchDeg: (next.pitch * 180) / Math.PI,
          rollDeg: (next.roll * 180) / Math.PI,
          battery: next.battery,
          throttle: input
            ? intensity * (input.boost > 1 ? 1 : intensity)
            : 1,
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Smooth ease-in-out (cubic) — feels nicer for cinematic flights than lin. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
