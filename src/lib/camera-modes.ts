import * as Cesium from "cesium";
import type { DroneState } from "./physics";
import type { CameraMode } from "./input";

const CHASE_DISTANCE = 18; // meters behind drone
const CHASE_HEIGHT = 6;    // meters above drone

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

  // Build a local ENU frame at the origin
  const originCart = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.altSeaLevel);
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);

  // Drone world position
  const dronePos = Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    new Cesium.Cartesian3(drone.position[0], drone.position[1], drone.position[2]),
    new Cesium.Cartesian3(),
  );

  if (mode === "chase") {
    // Position behind the drone in its body frame
    const offsetBody = chaseOffsetBody(drone.heading);
    const cameraEnu = new Cesium.Cartesian3(
      drone.position[0] + offsetBody.east,
      drone.position[1] + offsetBody.north,
      drone.position[2] + CHASE_HEIGHT,
    );
    const cameraWorld = Cesium.Matrix4.multiplyByPoint(enuFrame, cameraEnu, new Cesium.Cartesian3());
    viewer.camera.setView({
      destination: cameraWorld,
      orientation: Cesium.Cartesian3.subtract(dronePos, cameraWorld, new Cesium.Cartesian3()),
    });
    // Look-at: setView's orientation accepts a direction; build it explicitly
    const dir = Cesium.Cartesian3.subtract(dronePos, cameraWorld, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(dir, dir);
    // up = world-up at camera position (geocentric normal)
    const up = Cesium.Cartesian3.normalize(cameraWorld, new Cesium.Cartesian3());
    viewer.camera.direction = dir;
    viewer.camera.up = up;
    viewer.camera.right = Cesium.Cartesian3.cross(dir, up, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(viewer.camera.right, viewer.camera.right);
    return;
  }

  if (mode === "fpv") {
    // Camera at drone position, slightly forward, looking along heading
    const fwdBody = fpvOffsetBody(drone.heading, drone.pitch);
    const cameraEnu = new Cesium.Cartesian3(
      drone.position[0] + fwdBody.east * 0.6,
      drone.position[1] + fwdBody.north * 0.6,
      drone.position[2] + 0.2,
    );
    const cameraWorld = Cesium.Matrix4.multiplyByPoint(enuFrame, cameraEnu, new Cesium.Cartesian3());

    // Look direction in ENU: forward in body frame, including pitch
    const lookEnd = new Cesium.Cartesian3(
      cameraEnu.x + fwdBody.east * 100,
      cameraEnu.y + fwdBody.north * 100,
      cameraEnu.z + fwdBody.up * 100,
    );
    const lookEndWorld = Cesium.Matrix4.multiplyByPoint(enuFrame, lookEnd, new Cesium.Cartesian3());
    const dir = Cesium.Cartesian3.subtract(lookEndWorld, cameraWorld, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(dir, dir);

    const up = Cesium.Cartesian3.normalize(cameraWorld, new Cesium.Cartesian3());
    viewer.camera.position = cameraWorld;
    viewer.camera.direction = dir;
    viewer.camera.up = up;
    viewer.camera.right = Cesium.Cartesian3.cross(dir, up, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(viewer.camera.right, viewer.camera.right);
    return;
  }
}

function chaseOffsetBody(heading: number) {
  // Drone heading: 0 = +North, clockwise positive. To sit "behind", go opposite of forward.
  // Forward unit in ENU: (sin h, cos h, 0). Behind = -forward * distance.
  const e = -Math.sin(heading) * CHASE_DISTANCE;
  const n = -Math.cos(heading) * CHASE_DISTANCE;
  return { east: e, north: n };
}

function fpvOffsetBody(heading: number, pitch: number) {
  // Forward unit in ENU including pitch
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    east: Math.sin(heading) * cp,
    north: Math.cos(heading) * cp,
    up: sp,
  };
}
