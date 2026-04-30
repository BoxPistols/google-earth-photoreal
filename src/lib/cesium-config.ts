/**
 * Cesium runtime configuration helpers. Must run only on the client.
 */
import * as Cesium from "cesium";

let _configured = false;

export function configureCesium() {
  if (typeof window === "undefined" || _configured) return;

  // Tell Cesium where to find its Workers/Assets/Widgets.
  // copy-cesium-assets.mjs places them at /public/cesium.
  // When deployed under a basePath (e.g. GitHub Pages /<repo-name>), prepend
  // that basePath so Cesium fetches /<repo-name>/cesium/Workers/* correctly.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = `${basePath}/cesium`;

  const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  if (!token) {
    console.warn("[cesium] NEXT_PUBLIC_CESIUM_ION_TOKEN is not set — Photorealistic 3D Tiles will fail to load.");
  } else {
    Cesium.Ion.defaultAccessToken = token;
  }

  _configured = true;
}

/** Spawn point — Tokyo Station area, ~200 m AGL so the drone starts hovering
 *  comfortably above the city skyline. */
export const SPAWN_LON = 139.7670;
export const SPAWN_LAT = 35.6814;
export const SPAWN_ALT = 200;

/** Compose a 4x4 transform that places an object at (lon,lat,alt) with a given
 *  heading/pitch/roll, expressed in the local ENU frame at that point. */
export function hprAtLLA(
  lon: number,
  lat: number,
  alt: number,
  headingRad: number,
  pitchRad: number,
  rollRad: number,
): Cesium.Matrix4 {
  const origin = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  const hpr = new Cesium.HeadingPitchRoll(headingRad, pitchRad, rollRad);
  return Cesium.Transforms.headingPitchRollToFixedFrame(origin, hpr);
}

/** Convert local ENU offset (meters) at an origin LLA into world Cartesian3. */
export function enuOffsetToCartesian(
  originLon: number,
  originLat: number,
  originAltSeaLevel: number,
  east: number,
  north: number,
  up: number,
): Cesium.Cartesian3 {
  const originCart = Cesium.Cartesian3.fromDegrees(originLon, originLat, originAltSeaLevel);
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(originCart);
  return Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    new Cesium.Cartesian3(east, north, up),
    new Cesium.Cartesian3(),
  );
}
