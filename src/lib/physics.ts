/**
 * Arcade flight model in local East-North-Up (ENU) frame.
 *
 *   x = East   (+right when facing north)
 *   y = North  (+forward when heading = 0)
 *   z = Up
 *
 * Per the requirements doc §6: this is NOT a physics simulation. Inputs map
 * directly to a target velocity in the heading-aligned frame, and the drone's
 * actual velocity follows the target with an exponential time constant. With
 * no input, the target is zero and the drone hovers in place — no gravity, no
 * thrust, no drag terms to balance.
 *
 * Pitch and roll are cosmetic only: the body leans into the input direction so
 * the chase view shows believable banking, but the lean has no effect on motion.
 */

export interface DroneState {
  position: [number, number, number];
  velocity: [number, number, number];
  heading: number; // radians, 0 = north, +ve = clockwise from above
  pitch: number;   // radians, cosmetic lean only
  roll: number;    // radians, cosmetic lean only
  battery: number; // 0..1
}

export interface ControlInput {
  forward: number;     // -1..1   W/↑ = +1, S/↓ = -1
  vertical: number;    // -1..1   Q/Space = +1, E/Ctrl = -1
  yawRate: number;     // -1..1   D/→ = +1, A/← = -1
  mouseYawRad: number; // direct heading delta from mouse drag (radians)
  boost: number;       // multiplier on max speed; 1.0 normal, >1 sprinting (Shift)
}

export interface DroneParams {
  maxHorizSpeed: number;     // m/s
  maxVertSpeed: number;      // m/s
  yawRateDeg: number;        // deg/s for keyboard yaw
  followTimeConstSec: number;// velocity follow time constant (§6.3 = 0.3s)
  visualLeanDeg: number;     // peak cosmetic lean angle (§6.3 = 25°)
  leanRate: number;          // 1/s — how fast actual lean approaches target
  minAltitude: number;       // m AGL clamp (§6.3 = 5m)
  batteryDrainRate: number;  // fraction per second under full input
}

export const DEFAULT_PARAMS: DroneParams = {
  // Spec §6.3 starting values were 25/10/90/0.3 but at 200 m altitude looking
  // down on the skyline, that reads as glacial. Bumped for demo punch.
  maxHorizSpeed: 60,
  maxVertSpeed: 20,
  yawRateDeg: 120,
  followTimeConstSec: 0.2,
  visualLeanDeg: 25,
  leanRate: 6,
  minAltitude: 5,
  batteryDrainRate: 1 / (15 * 60),
};

const DEG = Math.PI / 180;

export function createInitialState(altitude = 200): DroneState {
  return {
    position: [0, 0, altitude],
    velocity: [0, 0, 0],
    heading: 0,
    pitch: 0,
    roll: 0,
    battery: 1,
  };
}

export function stepPhysics(
  state: DroneState,
  input: ControlInput,
  params: DroneParams,
  dt: number,
): DroneState {
  // --- Heading: keyboard rate + raw mouse delta ---
  const heading =
    state.heading +
    input.yawRate * params.yawRateDeg * DEG * dt +
    input.mouseYawRad;

  // --- Target velocity in world ENU, aligned to heading ---
  // Forward unit (heading=0 → +North): (sin h, cos h)
  const sh = Math.sin(heading);
  const ch = Math.cos(heading);
  const boost = Math.max(1, input.boost);
  const targetEast = input.forward * sh * params.maxHorizSpeed * boost;
  const targetNorth = input.forward * ch * params.maxHorizSpeed * boost;
  const targetUp = input.vertical * params.maxVertSpeed * boost;

  // --- Exponential approach toward target velocity ---
  // alpha = 1 - exp(-dt / tau).  Larger tau → softer response.
  const alpha = 1 - Math.exp(-dt / params.followTimeConstSec);
  const [vx, vy, vz] = state.velocity;
  const nvx = vx + (targetEast - vx) * alpha;
  const nvy = vy + (targetNorth - vy) * alpha;
  let nvz = vz + (targetUp - vz) * alpha;

  // --- Integrate position ---
  let nx = state.position[0] + nvx * dt;
  let ny = state.position[1] + nvy * dt;
  let nz = state.position[2] + nvz * dt;

  // Clamp at min altitude (simple ground guard; real terrain follow comes later)
  if (nz < params.minAltitude) {
    nz = params.minAltitude;
    if (nvz < 0) nvz = 0;
  }

  // --- Cosmetic body lean ---
  // Forward input → nose-down lean, yaw input → bank into the turn.
  const targetPitch = -input.forward * params.visualLeanDeg * DEG;
  const targetRoll = input.yawRate * params.visualLeanDeg * DEG * 0.6;
  const leanAlpha = 1 - Math.exp(-params.leanRate * dt);
  const pitch = state.pitch + (targetPitch - state.pitch) * leanAlpha;
  const roll = state.roll + (targetRoll - state.roll) * leanAlpha;

  // --- Battery drain proportional to input intensity ---
  const intensity = clamp01(
    Math.abs(input.forward) +
      Math.abs(input.vertical) +
      Math.abs(input.yawRate) * 0.3,
  );
  const drainRate = params.batteryDrainRate * (0.25 + 0.75 * intensity);
  const battery = Math.max(0, state.battery - drainRate * dt);

  return {
    position: [nx, ny, nz],
    velocity: [nvx, nvy, nvz],
    heading,
    pitch,
    roll,
    battery,
  };
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// --- Telemetry helpers ---

export function speedMps(s: DroneState): number {
  const [vx, vy, vz] = s.velocity;
  return Math.sqrt(vx * vx + vy * vy + vz * vz);
}

export function groundSpeedMps(s: DroneState): number {
  const [vx, vy] = s.velocity;
  return Math.sqrt(vx * vx + vy * vy);
}

export function climbRateMps(s: DroneState): number {
  return s.velocity[2];
}

/** Heading 0..360 (degrees), where 0 = North. */
export function headingDeg(s: DroneState): number {
  let d = (s.heading / DEG) % 360;
  if (d < 0) d += 360;
  return d;
}
