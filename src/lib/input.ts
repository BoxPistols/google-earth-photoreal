/**
 * Keyboard input → ControlInput.
 *
 * Layout (left hand on WASD, right hand on arrows / IJKL):
 *   W / S      = throttle up / down  (held to hover at ~hoverThrottle)
 *   A / D      = yaw left / right
 *   ↑ / ↓      = pitch forward / back
 *   ← / →      = roll left / right
 *   Space      = throttle pulse to full
 *   C          = cycle camera mode
 *   R          = reset drone to spawn
 */

import type { ControlInput } from "./physics";

export type CameraMode = "chase" | "fpv" | "free";

export interface InputAction {
  cycleCamera?: boolean;
  reset?: boolean;
}

const KEYS = new Set<string>();

export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    KEYS.add(e.key.toLowerCase());
    // prevent page scroll on arrows / space
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => KEYS.delete(e.key.toLowerCase());
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  };
}

const ACTION_QUEUE: InputAction[] = [];
export function attachActionKeys(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "c") ACTION_QUEUE.push({ cycleCamera: true });
    if (k === "r") ACTION_QUEUE.push({ reset: true });
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export function drainActions(): InputAction[] {
  const out = ACTION_QUEUE.splice(0, ACTION_QUEUE.length);
  return out;
}

/** Throttle is sticky — we hold the previous value and adjust by W/S so you can
 *  release the keys mid-flight without dropping like a stone. */
let _throttle = 0.4;

export function readControl(hoverThrottle: number, dt: number): ControlInput {
  // Throttle adjustment (held W/S)
  const upHeld = KEYS.has("w") || KEYS.has("shift");
  const dnHeld = KEYS.has("s");
  const adjust = (upHeld ? 1 : 0) - (dnHeld ? 1 : 0);
  _throttle = clamp(_throttle + adjust * 0.6 * dt, 0, 1);

  // Space = momentary boost
  let throttle = _throttle;
  if (KEYS.has(" ")) throttle = 1;

  // Yaw (A/D)
  const yaw = (KEYS.has("d") ? 1 : 0) - (KEYS.has("a") ? 1 : 0);

  // Pitch (arrow up/down): up = forward = +pitch
  const pitch = (KEYS.has("arrowup") ? 1 : 0) - (KEYS.has("arrowdown") ? 1 : 0);

  // Roll (arrow left/right): right = +roll
  const roll = (KEYS.has("arrowright") ? 1 : 0) - (KEYS.has("arrowleft") ? 1 : 0);

  // If user has not touched throttle yet, idle near hover for a calmer launch.
  void hoverThrottle;

  return { throttle, pitch, roll, yaw };
}

export function setThrottle(v: number) {
  _throttle = clamp(v, 0, 1);
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
