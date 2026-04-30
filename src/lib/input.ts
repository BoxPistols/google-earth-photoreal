/**
 * Keyboard + mouse input for the arcade flight model (§5.2).
 *
 * Keyboard (WASD と矢印キーは同じ機能のエイリアス):
 *   W / ↑     forward
 *   S / ↓     backward
 *   A / ←     yaw left
 *   D / →     yaw right
 *   Q / Space rise
 *   E / Ctrl  descend
 *   Shift     boost (held → 2.5× horizontal & vertical speed)
 *   C         cycle camera
 *   R         reset
 *   Esc       toggle pause
 *
 * Mouse (チェイス/FPV モード時に有効、フリー視点では Cesium がジャックする):
 *   Left drag   yaw the drone (X-delta accumulates as a heading delta)
 *   Wheel       adjust chase distance (consumed by camera, not physics)
 *   Double click "Go here" — handled in Simulator via raycast
 */

import type { ControlInput } from "./physics";

export type CameraMode = "chase" | "fpv" | "free";

export interface InputAction {
  cycleCamera?: boolean;
  reset?: boolean;
  togglePause?: boolean;
}

const KEYS = new Set<string>();
const ACTION_QUEUE: InputAction[] = [];

let _mouseYawAccum = 0;
let _wheelAccum = 0;
let _isLeftDragging = false;

const MOUSE_YAW_RAD_PER_PX = 0.005; // ~0.3° per pixel of horizontal drag

// --- Keyboard -----------------------------------------------------------------

/** True when keystrokes belong to a form field, not the drone. */
function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTypingTarget(e)) return;
    KEYS.add(e.key.toLowerCase());
    // Prevent page scroll on arrows / space
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
        e.key.toLowerCase(),
      )
    ) {
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => {
    if (isTypingTarget(e)) return;
    KEYS.delete(e.key.toLowerCase());
  };
  const blur = () => KEYS.clear(); // window loses focus → drop stuck keys
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

export function attachActionKeys(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (isTypingTarget(e)) return;
    const k = e.key.toLowerCase();
    if (k === "c") ACTION_QUEUE.push({ cycleCamera: true });
    if (k === "r") ACTION_QUEUE.push({ reset: true });
    if (k === "escape") ACTION_QUEUE.push({ togglePause: true });
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

export function drainActions(): InputAction[] {
  return ACTION_QUEUE.splice(0, ACTION_QUEUE.length);
}

// --- Mouse --------------------------------------------------------------------

export interface MouseControlOptions {
  onDoubleClick: (clientX: number, clientY: number) => void;
  isActive: () => boolean; // false in free-cam mode → skip our handlers
}

export function attachMouseControls(
  target: HTMLElement,
  opts: MouseControlOptions,
): () => void {
  const onDown = (e: MouseEvent) => {
    if (!opts.isActive()) return;
    if (e.button !== 0) return;
    _isLeftDragging = true;
  };
  const onUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    _isLeftDragging = false;
  };
  const onMove = (e: MouseEvent) => {
    if (!opts.isActive() || !_isLeftDragging) return;
    _mouseYawAccum += e.movementX * MOUSE_YAW_RAD_PER_PX;
  };
  const onWheel = (e: WheelEvent) => {
    if (!opts.isActive()) return;
    e.preventDefault();
    _wheelAccum += e.deltaY;
  };
  const onDbl = (e: MouseEvent) => {
    if (!opts.isActive()) return;
    opts.onDoubleClick(e.clientX, e.clientY);
  };

  target.addEventListener("mousedown", onDown);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("mousemove", onMove);
  target.addEventListener("wheel", onWheel, { passive: false });
  target.addEventListener("dblclick", onDbl);

  return () => {
    target.removeEventListener("mousedown", onDown);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("mousemove", onMove);
    target.removeEventListener("wheel", onWheel);
    target.removeEventListener("dblclick", onDbl);
    _isLeftDragging = false;
  };
}

export function drainMouseYaw(): number {
  const v = _mouseYawAccum;
  _mouseYawAccum = 0;
  return v;
}

export function drainWheel(): number {
  const v = _wheelAccum;
  _wheelAccum = 0;
  return v;
}

// --- Control read -------------------------------------------------------------

const BOOST_MULTIPLIER = 2.5;

export function readControl(): ControlInput {
  const fwd =
    (has("w") || has("arrowup") ? 1 : 0) -
    (has("s") || has("arrowdown") ? 1 : 0);
  const yaw =
    (has("d") || has("arrowright") ? 1 : 0) -
    (has("a") || has("arrowleft") ? 1 : 0);
  const vert =
    (has("q") || has(" ") ? 1 : 0) -
    (has("e") || has("control") ? 1 : 0);
  const boost = has("shift") ? BOOST_MULTIPLIER : 1;

  return {
    forward: fwd,
    vertical: vert,
    yawRate: yaw,
    mouseYawRad: drainMouseYaw(),
    boost,
  };
}

/** True if the user is currently giving any movement input (used to interrupt
 *  Go-here auto-fly). */
export function hasUserMotionInput(): boolean {
  return (
    has("w") ||
    has("s") ||
    has("a") ||
    has("d") ||
    has("q") ||
    has("e") ||
    has(" ") ||
    has("control") ||
    has("arrowup") ||
    has("arrowdown") ||
    has("arrowleft") ||
    has("arrowright")
  );
}

function has(k: string) {
  return KEYS.has(k);
}
