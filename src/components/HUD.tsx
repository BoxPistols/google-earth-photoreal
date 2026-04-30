"use client";

import { Box, Typography, LinearProgress } from "@mui/material";
import { useSimStore } from "@/store/sim-store";

const HUD_CYAN = "#22d3ee";
const HUD_AMBER = "#fbbf24";
const HUD_RED = "#ef4444";
const HUD_DIM = "rgba(34, 211, 238, 0.35)";

export default function HUD() {
  const t = useSimStore((s) => s.telemetry);
  const cameraMode = useSimStore((s) => s.cameraMode);
  const paused = useSimStore((s) => s.paused);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
        color: HUD_CYAN,
        textShadow: "0 0 8px rgba(34,211,238,0.6)",
      }}
    >
      {/* Top heading tape */}
      <HeadingTape headingDeg={t.headingDeg} />

      {/* Left telemetry: speed */}
      <TelemetryStack
        sx={{ left: 32, top: "50%", transform: "translateY(-50%)" }}
        label="GS m/s"
        value={t.groundSpeedMps.toFixed(1)}
        sub={`AS ${t.speedMps.toFixed(1)}`}
      />

      {/* Right telemetry: altitude */}
      <TelemetryStack
        sx={{ right: 32, top: "50%", transform: "translateY(-50%)" }}
        label="ALT m"
        value={t.altitudeM.toFixed(1)}
        sub={`VS ${t.climbRateMps >= 0 ? "+" : ""}${t.climbRateMps.toFixed(1)}`}
        align="right"
      />

      {/* Center: attitude indicator */}
      <AttitudeIndicator pitchDeg={t.pitchDeg} rollDeg={t.rollDeg} />

      {/* Bottom-left: throttle + battery */}
      <Box sx={{ position: "absolute", left: 32, bottom: 32, width: 220 }}>
        <BarReadout label="THR" value={t.throttle} color={HUD_CYAN} />
        <Box sx={{ height: 12 }} />
        <BarReadout
          label="BAT"
          value={t.battery}
          color={t.battery < 0.2 ? HUD_RED : t.battery < 0.4 ? HUD_AMBER : HUD_CYAN}
        />
      </Box>

      {/* Bottom-right: camera mode + controls hint */}
      <Box sx={{ position: "absolute", right: 32, bottom: 32, textAlign: "right" }}>
        <Typography variant="caption" sx={{ display: "block", color: HUD_DIM, letterSpacing: 2 }}>
          CAM
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 600, letterSpacing: 4 }}>
          {cameraMode.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: HUD_DIM, lineHeight: 1.6 }}>
          W/S throttle &nbsp; A/D yaw<br />
          ↑↓ pitch &nbsp; ←→ roll<br />
          SPACE boost &nbsp; C cam &nbsp; R reset
        </Typography>
      </Box>

      {/* Pause overlay */}
      {paused && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.45)",
          }}
        >
          <Typography sx={{ fontSize: 64, letterSpacing: 16, color: HUD_AMBER }}>
            PAUSED
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// --- Sub-components ---

function HeadingTape({ headingDeg }: { headingDeg: number }) {
  // Render a strip of compass marks centered on current heading
  const ticks: { deg: number; label: string }[] = [];
  for (let d = -60; d <= 60; d += 10) {
    const tickDeg = (Math.round(headingDeg / 10) * 10 + d + 360) % 360;
    ticks.push({ deg: d, label: tickDeg.toString().padStart(3, "0") });
  }
  const cardinals: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: 480,
        height: 56,
        border: `1px solid ${HUD_DIM}`,
        bgcolor: "rgba(0, 8, 12, 0.55)",
        backdropFilter: "blur(2px)",
        overflow: "hidden",
      }}
    >
      {ticks.map((t, i) => {
        const x = 240 + (t.deg / 60) * 240; // -60..+60 maps to 0..480
        const isMajor = parseInt(t.label, 10) % 30 === 0;
        const cardinal = cardinals[parseInt(t.label, 10)];
        return (
          <Box
            key={i}
            sx={{
              position: "absolute",
              left: x,
              top: 0,
              transform: "translateX(-50%)",
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 1,
                height: isMajor ? 14 : 8,
                bgcolor: HUD_CYAN,
                margin: "0 auto",
              }}
            />
            {isMajor && (
              <Typography sx={{ fontSize: 13, lineHeight: 1.2, mt: 0.25 }}>
                {cardinal ?? t.label}
              </Typography>
            )}
          </Box>
        );
      })}
      {/* Center indicator */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 0,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `10px solid ${HUD_AMBER}`,
        }}
      />
    </Box>
  );
}

function AttitudeIndicator({ pitchDeg, rollDeg }: { pitchDeg: number; rollDeg: number }) {
  // Simple 2D artificial horizon. SVG, ~180px circle.
  const SIZE = 180;
  // Pitch shifts horizon vertically (1 deg = 2 px in our scale)
  const pitchOffset = pitchDeg * 2;

  return (
    <Box
      sx={{
        position: "absolute",
        left: "50%",
        bottom: 32,
        transform: "translateX(-50%)",
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        border: `1px solid ${HUD_DIM}`,
        bgcolor: "rgba(0, 8, 12, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          transform: `rotate(${-rollDeg}deg)`,
          transformOrigin: "center",
        }}
      >
        {/* Sky/ground horizon */}
        <Box
          sx={{
            position: "absolute",
            left: -SIZE / 2,
            right: -SIZE / 2,
            top: SIZE / 2 + pitchOffset,
            height: SIZE * 2,
            background: `linear-gradient(to bottom, rgba(34,211,238,0.12) 0%, rgba(34,211,238,0.04) 100%)`,
            borderTop: `1.5px solid ${HUD_CYAN}`,
          }}
        />
        {/* Pitch ladder */}
        {[-30, -20, -10, 10, 20, 30].map((p) => {
          const y = SIZE / 2 + pitchOffset - p * 2;
          if (y < 0 || y > SIZE) return null;
          return (
            <Box
              key={p}
              sx={{
                position: "absolute",
                left: "50%",
                top: y,
                transform: "translate(-50%, -50%)",
                width: Math.abs(p) > 20 ? 30 : 50,
                height: 1,
                bgcolor: HUD_DIM,
                "&::after": {
                  content: `"${p > 0 ? `+${p}` : p}"`,
                  position: "absolute",
                  right: -28,
                  top: -8,
                  fontSize: 10,
                  color: HUD_DIM,
                },
              }}
            />
          );
        })}
      </Box>
      {/* Center reference (fixed to aircraft) */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 60,
          height: 2,
          bgcolor: HUD_AMBER,
          boxShadow: `0 0 6px ${HUD_AMBER}`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 4,
          height: 4,
          bgcolor: HUD_AMBER,
          borderRadius: "50%",
          boxShadow: `0 0 6px ${HUD_AMBER}`,
        }}
      />
    </Box>
  );
}

function TelemetryStack({
  sx,
  label,
  value,
  sub,
  align = "left",
}: {
  sx: object;
  label: string;
  value: string;
  sub?: string;
  align?: "left" | "right";
}) {
  return (
    <Box sx={{ position: "absolute", textAlign: align, ...sx }}>
      <Typography variant="caption" sx={{ display: "block", color: HUD_DIM, letterSpacing: 3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ display: "block", color: HUD_DIM, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function BarReadout({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: HUD_DIM, letterSpacing: 3 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(value * 100)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value * 100}
        sx={{
          height: 6,
          bgcolor: "rgba(34,211,238,0.12)",
          "& .MuiLinearProgress-bar": {
            bgcolor: color,
            boxShadow: `0 0 8px ${color}`,
          },
        }}
      />
    </Box>
  );
}
