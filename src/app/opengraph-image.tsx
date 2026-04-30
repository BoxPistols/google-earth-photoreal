import { ImageResponse } from "next/og";

// Edge runtime + force-static so Next can pre-render the OG image at build
// time for `output: 'export'`.
export const runtime = "edge";
export const dynamic = "force-static";
export const alt = "Drone Flight Sim";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "radial-gradient(circle at 30% 20%, #1e3a5f 0%, #0b1220 55%, #050912 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
          padding: 80,
        }}
      >
        <svg
          width="220"
          height="220"
          viewBox="0 0 180 180"
          style={{ marginBottom: 40 }}
        >
          <g stroke="#7dd3fc" strokeWidth="9" strokeLinecap="round" fill="none">
            <line x1="90" y1="90" x2="36" y2="36" />
            <line x1="90" y1="90" x2="144" y2="36" />
            <line x1="90" y1="90" x2="36" y2="144" />
            <line x1="90" y1="90" x2="144" y2="144" />
          </g>
          <circle cx="36" cy="36" r="17" fill="#38bdf8" />
          <circle cx="144" cy="36" r="17" fill="#38bdf8" />
          <circle cx="36" cy="144" r="17" fill="#38bdf8" />
          <circle cx="144" cy="144" r="17" fill="#38bdf8" />
          <circle cx="90" cy="90" r="18" fill="#f8fafc" />
          <circle cx="90" cy="90" r="7" fill="#0b1220" />
        </svg>
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -2,
            display: "flex",
          }}
        >
          Drone Flight Sim
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            color: "#bae6fd",
            display: "flex",
            textAlign: "center",
          }}
        >
          Photorealistic 3D Tiles · Fly anywhere on Earth
        </div>
      </div>
    ),
    size,
  );
}
