/**
 * Simplified quadcopter physics in local East-North-Up (ENU) frame.
 *
 * Convention:
 *   x = East   (right when facing north)
 *   y = North  (forward when heading = 0)
 *   z = Up
 *
 *   heading: rotation about +z, 0 = north, +ve = clockwise from above (radians)
 *   pitch:   rotation about local x (east) axis after heading; +ve = nose up
 *   roll:    rotation about local y (north) axis after heading+pitch; +ve = right wing down
 *
 * The flight model is "self-leveling angle mode" for pitch/roll (inputs map to
 * target lean angles) and rate mode for yaw — this matches how most consumer
 * drones feel in their stabilized flight mode.
 */

export interface DroneState {
  // Position relative to ENU origin, meters
  position: [number, number, number];
  // Velocity in ENU frame, m/s
  velocity: [number, number, number];
  // Euler angles, radians
  heading: number;
  pitch: number;
  roll: number;
  // Battery 0..1
  battery: number;
}

export interface ControlInput {
  throttle: number; // 0..1
  pitch: number;    // -1..1 (forward = +1)
  roll: number;     // -1..1 (right = +1)
  yaw: number;      // -1..1 (right = +1)
}

export interface DroneParams {
  mass: number;            // kg
  maxThrust: number;       // N (total, all 4 motors at full)
  hoverThrottle: number;   // throttle value that produces thrust = mg
  maxLeanDeg: number;      // peak target pitch/roll angle in angle mode
  maxYawRateDeg: number;   // peak yaw rate, deg/s
  stabilizeRate: number;   // 1/s — how fast actual angle approaches target
  linearDrag: number;      // N·s/m
  batteryDrainRate: number;// fraction per second at full throttle
}

export const DEFAULT_PARAMS: DroneParams = {
  mass: 0.9,                // ~DJI Mavic class
  maxThrust: 22,            // N — gives ~2.5:1 thrust-to-weight
  hoverThrottle: 0.4,
  maxLeanDeg: 30,
  maxYawRateDeg: 120,
  stabilizeRate: 6,
  linearDrag: 0.35,
  batteryDrainRate: 1 / (15 * 60), // 15 minutes at full throttle
};

const G = 9.80665;
const DEG = Math.PI / 180;

export function createInitialState(altitude = 2): DroneState {
  return {
    position: [0, 0, altitude],
    velocity: [0, 0, 0],
    heading: 0,
    pitch: 0,
    roll: 0,
    battery: 1,
  };
}

/**
 * Rotate a body-frame vector into the ENU world frame using the drone's
 * heading/pitch/roll. Order: yaw (Z) -> pitch (X) -> roll (Y).
 */
function bodyToWorld(
  v: [number, number, number],
  heading: number,
  pitch: number,
  roll: number,
): [number, number, number] {
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const cp = Math.cos(pitch),   sp = Math.sin(pitch);
  const cr = Math.cos(roll),    sr = Math.sin(roll);

  // R = Rz(heading) * Rx(pitch) * Ry(roll)  applied to body vector.
  // Note: heading is clockwise-from-above, so Rz uses (ch, sh) with sign flips.
  const [bx, by, bz] = v;

  // Ry(roll)
  const x1 =  cr * bx + sr * bz;
  const y1 =  by;
  const z1 = -sr * bx + cr * bz;

  // Rx(pitch)
  const x2 = x1;
  const y2 = cp * y1 - sp * z1;
  const z2 = sp * y1 + cp * z1;

  // Rz(heading) — clockwise from above means rotating East toward South
  const x3 =  ch * x2 + sh * y2;
  const y3 = -sh * x2 + ch * y2;
  const z3 =  z2;

  return [x3, y3, z3];
}

export function stepPhysics(
  state: DroneState,
  input: ControlInput,
  params: DroneParams,
  dt: number,
): DroneState {
  // --- Attitude (angle-mode pitch/roll, rate-mode yaw) ---
  const targetPitch = input.pitch * params.maxLeanDeg * DEG;
  const targetRoll  = input.roll  * params.maxLeanDeg * DEG;

  // Exponential approach toward target angle. alpha = 1 - exp(-rate*dt)
  const alpha = 1 - Math.exp(-params.stabilizeRate * dt);
  const pitch = state.pitch + (targetPitch - state.pitch) * alpha;
  const roll  = state.roll  + (targetRoll  - state.roll ) * alpha;
  const heading = state.heading + input.yaw * params.maxYawRateDeg * DEG * dt;

  // --- Linear dynamics ---
  // Thrust along body +z, rotated to world.
  const thrustMag = input.throttle * params.maxThrust;
  const [tx, ty, tz] = bodyToWorld([0, 0, thrustMag], heading, pitch, roll);

  // Gravity
  const gz = -G * params.mass;

  // Drag opposing velocity
  const [vx, vy, vz] = state.velocity;
  const dx = -params.linearDrag * vx;
  const dy = -params.linearDrag * vy;
  const dz = -params.linearDrag * vz;

  // Sum forces -> acceleration
  const ax = (tx + dx) / params.mass;
  const ay = (ty + dy) / params.mass;
  const az = (tz + gz + dz) / params.mass;

  // Integrate
  let nvx = vx + ax * dt;
  let nvy = vy + ay * dt;
  let nvz = vz + az * dt;

  let nx = state.position[0] + nvx * dt;
  let ny = state.position[1] + nvy * dt;
  let nz = state.position[2] + nvz * dt;

  // Ground collision (very simple — z=0 plane). Real terrain follow comes in a later phase.
  if (nz < 0) {
    nz = 0;
    if (nvz < 0) nvz = 0;
    // Friction on touchdown
    nvx *= 0.85;
    nvy *= 0.85;
  }

  // --- Battery ---
  const drainRate = params.batteryDrainRate * (0.2 + 0.8 * input.throttle);
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
