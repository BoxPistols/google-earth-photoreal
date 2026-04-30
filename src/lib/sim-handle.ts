/**
 * Module-singleton handle exposed by Simulator.tsx so out-of-tree components
 * (SearchBox, future ControlPanel) can issue teleport / geocode requests
 * without prop-drilling the Cesium Viewer through React context.
 *
 * Simulator is mounted exactly once per page (dynamic import, ssr:false), so a
 * module-scoped singleton is safe.
 */
import * as Cesium from "cesium";

export interface SimHandle {
  scene: Cesium.Scene;
  /** Re-anchor the ENU origin to (lon, lat) and place the drone hovering at
   *  `altitude` meters above the ellipsoid there. Velocity is zeroed. */
  teleport: (lon: number, lat: number, altitude: number) => void;
  startTour: () => void;
  stopTour: () => void;
}

let _handle: SimHandle | null = null;

export function registerSimHandle(h: SimHandle) {
  _handle = h;
}

export function clearSimHandle() {
  _handle = null;
}

export function startTour() {
  _handle?.startTour();
}

export function stopTour() {
  _handle?.stopTour();
}

export interface GeocodeHit {
  displayName: string;
  lon: number;
  lat: number;
}

/** Geocode `query` via Cesium ion (Bing under the hood) and teleport the drone
 *  to the first result at `altitude` m above ellipsoid. */
export async function searchAndTeleport(
  query: string,
  altitude = 500,
): Promise<GeocodeHit | null> {
  if (!_handle) return null;
  const service = new Cesium.IonGeocoderService({ scene: _handle.scene });
  const results = await service.geocode(query);
  if (!results || results.length === 0) return null;

  const r = results[0];
  const dest = r.destination as Cesium.Cartesian3 | Cesium.Rectangle;

  let lon: number, lat: number;
  if (dest instanceof Cesium.Rectangle) {
    const c = Cesium.Rectangle.center(dest);
    lon = Cesium.Math.toDegrees(c.longitude);
    lat = Cesium.Math.toDegrees(c.latitude);
  } else {
    const carto = Cesium.Cartographic.fromCartesian(dest);
    lon = Cesium.Math.toDegrees(carto.longitude);
    lat = Cesium.Math.toDegrees(carto.latitude);
  }

  _handle.teleport(lon, lat, altitude);
  return { displayName: r.displayName, lon, lat };
}
