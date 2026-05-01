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
  /** Cinematic interpolated flight from current position to destination. */
  flyTo: (lon: number, lat: number, altitude: number) => void;
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

function destToLonLat(dest: Cesium.Cartesian3 | Cesium.Rectangle): {
  lon: number;
  lat: number;
} {
  if (dest instanceof Cesium.Rectangle) {
    const c = Cesium.Rectangle.center(dest);
    return {
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
    };
  }
  const carto = Cesium.Cartographic.fromCartesian(dest);
  return {
    lon: Cesium.Math.toDegrees(carto.longitude),
    lat: Cesium.Math.toDegrees(carto.latitude),
  };
}

/** Geocode `query` via Cesium ion and return up to `limit` candidates. */
export async function searchPlaces(
  query: string,
  limit = 6,
): Promise<GeocodeHit[]> {
  if (!_handle || !query.trim()) return [];
  const service = new Cesium.IonGeocoderService({ scene: _handle.scene });
  const results = await service.geocode(query);
  if (!results) return [];
  return results.slice(0, limit).map((r) => {
    const ll = destToLonLat(r.destination as Cesium.Cartesian3 | Cesium.Rectangle);
    return { displayName: r.displayName, lon: ll.lon, lat: ll.lat };
  });
}

/** Geocode + cinematic fly to first result. Returns the resolved hit. */
export async function searchAndFly(
  query: string,
  altitude = 500,
): Promise<GeocodeHit | null> {
  const hits = await searchPlaces(query, 1);
  if (!hits.length) return null;
  flyToHit(hits[0], altitude);
  return hits[0];
}

/** Cinematically fly the drone to a known geocoded hit. */
export function flyToHit(hit: GeocodeHit, altitude = 500) {
  _handle?.flyTo(hit.lon, hit.lat, altitude);
}
