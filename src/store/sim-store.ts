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

interface SimState {
  telemetry: Telemetry;
  cameraMode: CameraMode;
  paused: boolean;
  setTelemetry: (t: Telemetry) => void;
  setCameraMode: (m: CameraMode) => void;
  togglePause: () => void;
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
  setTelemetry: (telemetry) => set({ telemetry }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
}));
