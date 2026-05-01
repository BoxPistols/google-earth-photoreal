import { create } from "zustand";
import type { CameraMode } from "@/lib/input";

export interface Telemetry {
  altitudeM: number;
  speedMps: number;
  groundSpeedMps: number;
  climbRateMps: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  battery: number;     // 0..1
  throttle: number;    // 0..1
}

export interface PendingPin {
  lon: number;
  lat: number;
  altitude: number; // meters above ellipsoid for the fly destination
  clientX: number;  // screen position where the user clicked
  clientY: number;
  label?: string;   // optional reverse-geocoded name
}

export interface ElevationSample {
  t: number;       // ms timestamp (performance.now relative)
  drone: number;   // drone altitude, m above ellipsoid
  terrain: number; // sampled ground/rooftop height directly below, m
}

interface SimState {
  telemetry: Telemetry;
  cameraMode: CameraMode;
  paused: boolean;
  tilesetReady: boolean;
  tilesetError: string | null;
  tourActive: boolean;
  tourLandmarkName: string | null;
  elevationSamples: ElevationSample[];
  noFlyZoneVisible: boolean;
  pendingPin: PendingPin | null;
  setTelemetry: (t: Telemetry) => void;
  setCameraMode: (m: CameraMode) => void;
  togglePause: () => void;
  setTilesetReady: (ready: boolean) => void;
  setTilesetError: (err: string | null) => void;
  setTourState: (active: boolean, name: string | null) => void;
  pushElevationSample: (s: ElevationSample) => void;
  toggleNoFlyZone: () => void;
  setPendingPin: (pin: PendingPin | null) => void;
}

export const useSimStore = create<SimState>((set) => ({
  telemetry: {
    altitudeM: 0,
    speedMps: 0,
    groundSpeedMps: 0,
    climbRateMps: 0,
    headingDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    battery: 1,
    throttle: 0.4,
  },
  cameraMode: "chase",
  paused: false,
  tilesetReady: false,
  tilesetError: null,
  tourActive: false,
  tourLandmarkName: null,
  elevationSamples: [],
  noFlyZoneVisible: false,
  pendingPin: null,
  setTelemetry: (telemetry) => set({ telemetry }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setTilesetReady: (tilesetReady) => set({ tilesetReady }),
  setTilesetError: (tilesetError) => set({ tilesetError }),
  setTourState: (tourActive, tourLandmarkName) =>
    set({ tourActive, tourLandmarkName }),
  pushElevationSample: (sample) =>
    set((state) => {
      const cutoff = sample.t - 60_000;
      const filtered = state.elevationSamples.filter((s) => s.t >= cutoff);
      return { elevationSamples: [...filtered, sample] };
    }),
  toggleNoFlyZone: () =>
    set((s) => ({ noFlyZoneVisible: !s.noFlyZoneVisible })),
  setPendingPin: (pendingPin) => set({ pendingPin }),
}));
