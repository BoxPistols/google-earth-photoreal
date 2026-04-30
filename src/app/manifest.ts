import type { MetadataRoute } from "next";

// Required for `output: 'export'` (GitHub Pages static export).
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drone Flight Sim",
    short_name: "DroneSim",
    description:
      "Photorealistic drone flight simulator built on Cesium + Google Photorealistic 3D Tiles.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    lang: "ja",
    categories: ["games", "entertainment", "navigation"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
