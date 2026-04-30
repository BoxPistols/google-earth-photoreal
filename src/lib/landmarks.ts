/**
 * Auto-tour landmark presets. Each entry teleports the drone to (lon, lat) at
 * `altitude` m above the ellipsoid; the tour camera then orbits in place for a
 * few seconds before advancing to the next.
 *
 * Altitude is chosen per-landmark so the iconic structure isn't intersecting
 * the drone (e.g. Skytree is 634 m tall, so we hover at 800 m).
 */

export interface Landmark {
  id: string;
  name: string;
  lon: number;
  lat: number;
  altitude: number; // meters above ellipsoid
}

export const TOKYO_TOUR: Landmark[] = [
  { id: "tokyo-station",    name: "東京駅",                lon: 139.7670, lat: 35.6814, altitude: 400 },
  { id: "imperial-palace",  name: "皇居",                  lon: 139.7528, lat: 35.6852, altitude: 500 },
  { id: "tokyo-tower",      name: "東京タワー",            lon: 139.7454, lat: 35.6586, altitude: 550 },
  { id: "national-stadium", name: "国立競技場",            lon: 139.7144, lat: 35.6779, altitude: 400 },
  { id: "shinjuku",         name: "新宿都庁",              lon: 139.6921, lat: 35.6896, altitude: 550 },
  { id: "shibuya",          name: "渋谷スクランブル交差点", lon: 139.7004, lat: 35.6595, altitude: 380 },
  { id: "skytree",          name: "東京スカイツリー",      lon: 139.8107, lat: 35.7101, altitude: 850 },
];
