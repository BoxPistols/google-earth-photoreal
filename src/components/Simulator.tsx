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
  type DroneState,
} from "@/lib/physics";
import {
  attachKeyboard,
  attachActionKeys,
  drainActions,
  readControl,
  type CameraMode,
} from "@/lib/input";
import { updateCamera } from "@/lib/camera-modes";
import { useSimStore } from "@/store/sim-store";

const ORIGIN_ALT_SEA_LEVEL = 0; // we treat drone z=0 as roughly sea level for simplicity in Phase 1

export default function Simulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const droneEntityRef = useRef<Cesium.Entity | null>(null);
  const stateRef = useRef<DroneState>(createInitialState(SPAWN_ALT));
  const cameraModeRef = useRef<CameraMode>("chase");
  const lastTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);

  const setTelemetry = useSimStore((s) => s.setTelemetry);
  const setCameraMode = useSimStore((s) => s.setCameraMode);

  useEffect(() => {
    if (!containerRef.current) return;
    configureCesium();

    const viewer = new Cesium.Viewer(containerRef.current, {
      // Hide every default widget — we'll draw our own HUD.
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
      // Don't load default imagery — Photorealistic 3D Tiles supplies it.
      baseLayer: false as unknown as Cesium.ImageryLayer,
      // We're piloting a vehicle; we don't need terrain on top of the photorealistic tiles.
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    viewerRef.current = viewer;

    // Disable Cesium's default zoom-to-cursor behavior in chase/fpv modes
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Atmosphere & lighting niceties
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.globe.enableLighting = true;

    // Load Google Photorealistic 3D Tiles via Cesium ion
    (async () => {
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset();
        viewer.scene.primitives.add(tileset);
      } catch (err) {
        console.error("[cesium] failed to load Photorealistic 3D Tiles:", err);
      }
    })();

    // Create the drone entity — bright box for now, swap a glTF later.
    const positionProp = new Cesium.CallbackProperty(() => {
      const s = stateRef.current;
      const originCart = Cesium.Cartesian3.fromDegrees(SPAWN_LON, SPAWN_LAT, ORIGIN_ALT_SEA_LEVEL);
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);
      return Cesium.Matrix4.multiplyByPoint(
        enu,
        new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
        new Cesium.Cartesian3(),
      );
    }, false);

    const orientationProp = new Cesium.CallbackProperty(() => {
      const s = stateRef.current;
      const originCart = Cesium.Cartesian3.fromDegrees(SPAWN_LON, SPAWN_LAT, ORIGIN_ALT_SEA_LEVEL);
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);
      // Drone position in world
      const pos = Cesium.Matrix4.multiplyByPoint(
        enu,
        new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
        new Cesium.Cartesian3(),
      );
      const hpr = new Cesium.HeadingPitchRoll(s.heading, s.pitch, s.roll);
      return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
    }, false);

    const drone = viewer.entities.add({
      name: "Drone",
      position: positionProp,
      orientation: orientationProp,
      box: {
        dimensions: new Cesium.Cartesian3(1.2, 1.2, 0.35),
        material: Cesium.Color.fromCssColorString("#22d3ee"),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
      // A small forward-pointing arrow so you can read the heading from chase view
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const s = stateRef.current;
          const originCart = Cesium.Cartesian3.fromDegrees(SPAWN_LON, SPAWN_LAT, ORIGIN_ALT_SEA_LEVEL);
          const enu = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);
          const tail = Cesium.Matrix4.multiplyByPoint(
            enu,
            new Cesium.Cartesian3(s.position[0], s.position[1], s.position[2]),
            new Cesium.Cartesian3(),
          );
          // Forward 3 m in body frame, projected to ENU including heading/pitch
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
    droneEntityRef.current = drone;

    // --- Input wiring ---
    const detachInputs = attachKeyboard();
    const detachActions = attachActionKeys();

    // --- Game loop ---
    const tick = (now: number) => {
      const dtMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      const dt = Math.min(0.05, dtMs / 1000); // clamp big stalls

      // Process discrete actions
      for (const a of drainActions()) {
        if (a.cycleCamera) {
          const order: CameraMode[] = ["chase", "fpv", "free"];
          const next = order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
          cameraModeRef.current = next;
          setCameraMode(next);
          // When entering free, hand mouse control back to Cesium
          viewer.scene.screenSpaceCameraController.enableInputs = next === "free";
        }
        if (a.reset) {
          stateRef.current = createInitialState(SPAWN_ALT);
        }
      }

      // Step physics
      const input = readControl(DEFAULT_PARAMS.hoverThrottle, dt);
      const next = stepPhysics(stateRef.current, input, DEFAULT_PARAMS, dt);
      stateRef.current = next;

      // Update camera
      updateCamera(viewer, cameraModeRef.current, next, {
        lon: SPAWN_LON,
        lat: SPAWN_LAT,
        altSeaLevel: ORIGIN_ALT_SEA_LEVEL,
      });

      // Push telemetry to the HUD store at a modest cadence (~30 Hz is plenty)
      setTelemetry({
        altitudeM: next.position[2],
        speedMps: speedMps(next),
        groundSpeedMps: groundSpeedMps(next),
        climbRateMps: climbRateMps(next),
        headingDeg: headingDeg(next),
        pitchDeg: (next.pitch * 180) / Math.PI,
        rollDeg: (next.roll * 180) / Math.PI,
        battery: next.battery,
        throttle: input.throttle,
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Initial camera pose
    viewer.scene.screenSpaceCameraController.enableInputs = false;

    return () => {
      cancelAnimationFrame(rafRef.current);
      detachInputs();
      detachActions();
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
