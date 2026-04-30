import * as Cesium from "cesium";
import type { DroneState } from "./physics";
import type { CameraMode } from "./input";

let CHASE_DISTANCE = 18; // meters behind drone (mutable: wheel adjusts)
const CHASE_HEIGHT = 6;  // meters above drone

const CHASE_MIN = 6;
const CHASE_MAX = 80;
const CHASE_PER_WHEEL_PX = 0.05; // m per wheel-deltaY pixel

/** Called from Simulator on mouse-wheel events. Positive delta zooms out. */
export function adjustChaseDistance(wheelDeltaY: number) {
  const next = CHASE_DISTANCE + wheelDeltaY * CHASE_PER_WHEEL_PX;
  CHASE_DISTANCE = Math.min(CHASE_MAX, Math.max(CHASE_MIN, next));
}

/**
 * Update the Cesium camera based on the current mode and drone state.
 * Origin lat/lon defines the local ENU frame the drone position is expressed in.
 */
export function updateCamera(
  viewer: Cesium.Viewer,
  mode: CameraMode,
  drone: DroneState,
  origin: { lon: number; lat: number; altSeaLevel: number },
) {
  if (mode === "free") return; // user controls camera with mouse

  const originCart = Cesium.Cartesian3.fromDegrees(
    origin.lon,
    origin.lat,
    origin.altSeaLevel,
  );
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);

  // Drone world position
  const dronePos = Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    new Cesium.Cartesian3(drone.position[0], drone.position[1], drone.position[2]),
    new Cesium.Cartesian3(),
  );

  if (mode === "chase") {
    const offsetBody = chaseOffsetBody(drone.heading);
    const cameraEnu = new Cesium.Cartesian3(
      drone.position[0] + offsetBody.east,
      drone.position[1] + offsetBody.north,
      drone.position[2] + CHASE_HEIGHT,
    );
    const cameraWorld = Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      cameraEnu,
      new Cesium.Cartesian3(),
    );
    lookAt(viewer, cameraWorld, dronePos);
    return;
  }

  if (mode === "fpv") {
    const fwdBody = fpvOffsetBody(drone.heading, drone.pitch);
    const cameraEnu = new Cesium.Cartesian3(
      drone.position[0] + fwdBody.east * 0.6,
      drone.position[1] + fwdBody.north * 0.6,
      drone.position[2] + 0.2,
    );
    const cameraWorld = Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      cameraEnu,
      new Cesium.Cartesian3(),
    );
    const lookEnd = new Cesium.Cartesian3(
      cameraEnu.x + fwdBody.east * 100,
      cameraEnu.y + fwdBody.north * 100,
      cameraEnu.z + fwdBody.up * 100,
    );
    const lookEndWorld = Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      lookEnd,
      new Cesium.Cartesian3(),
    );
    lookAt(viewer, cameraWorld, lookEndWorld);
    return;
  }
}

/**
 * Point the camera from `position` toward `target`, deriving an orthonormal
 * (direction, up, right) basis from the local zenith. Uses Cesium's setView so
 * the view matrix is rebuilt cleanly — direct mutation of camera.up etc. is
 * fragile because the components must be mutually perpendicular and Cesium
 * doesn't re-orthogonalize them.
 */
function lookAt(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian3,
  target: Cesium.Cartesian3,
) {
  const dir = Cesium.Cartesian3.subtract(target, position, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(dir, dir);

  // Local zenith at the camera position (geocentric radial outward).
  const zenith = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());

  // right = dir × zenith,  up = right × dir  → orthonormal triad with up
  // perpendicular to dir (unlike just using zenith as "up").
  const right = Cesium.Cartesian3.cross(dir, zenith, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(right, right);

  const up = Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(up, up);

  viewer.camera.setView({
    destination: position,
    orientation: { direction: dir, up },
  });
}

function chaseOffsetBody(heading: number) {
  const e = -Math.sin(heading) * CHASE_DISTANCE;
  const n = -Math.cos(heading) * CHASE_DISTANCE;
  return { east: e, north: n };
}

function fpvOffsetBody(heading: number, pitch: number) {
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return {
    east: Math.sin(heading) * cp,
    north: Math.cos(heading) * cp,
    up: sp,
  };
}
