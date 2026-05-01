import type { MetadataRoute } from "next";

// Required for `output: 'export'` (GitHub Pages static export).
export const dynamic = "force-static";

// On Pages we deploy under /<repo>, so manifest URLs need the prefix.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const root = basePath ? `${basePath}/` : "/";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drone Flight Sim",
    short_name: "DroneSim",
    description:
      "Photorealistic drone flight simulator built on Cesium + Google Photorealistic 3D Tiles.",
    start_url: root,
    scope: root,
    display: "standalone",
    orientation: "landscape",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    lang: "ja",
    categories: ["games", "entertainment", "navigation"],
    icons: [
      { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `${basePath}/apple-icon.svg`, sizes: "180x180", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
