"use client";

import { Box, Tooltip, Typography, LinearProgress } from "@mui/material";
import { useSimStore } from "@/store/sim-store";

const HUD_CYAN = "#22d3ee";
const HUD_AMBER = "#fbbf24";
const HUD_RED = "#ef4444";
const HUD_DIM = "rgba(34, 211, 238, 0.6)";

// Solid-enough background so text stays readable over bright satellite imagery.
const PANEL_BG = "rgba(0, 8, 12, 0.78)";
const PANEL_BORDER = "rgba(34, 211, 238, 0.25)";

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
      }}
    >
      <HeadingTape headingDeg={t.headingDeg} />

      {/* Left: ground / air speed */}
      <TelemetryPanel
        sx={{ left: 24, top: "50%", transform: "translateY(-50%)" }}
        label="GS · 対地速度"
        value={`${t.groundSpeedMps.toFixed(1)} m/s`}
        sub={`AS ${t.speedMps.toFixed(1)} m/s`}
        tooltip="GS = Ground Speed (水平方向の速度) / AS = Air Speed (3D 合成速度)"
      />

      {/* Right: altitude */}
      <TelemetryPanel
        sx={{ right: 24, top: "50%", transform: "translateY(-50%)" }}
        label="ALT · 高度"
        value={`${t.altitudeM.toFixed(1)} m`}
        sub={`VS ${t.climbRateMps >= 0 ? "+" : ""}${t.climbRateMps.toFixed(1)} m/s`}
        align="right"
        tooltip="ALT = 楕円体面からのドローン高度 / VS = Vertical Speed (上昇率)"
      />

      <AttitudeIndicator pitchDeg={t.pitchDeg} rollDeg={t.rollDeg} />

      {/* Bottom-left: throttle + battery */}
      <Box
        sx={{
          position: "absolute",
          left: 24,
          bottom: 24,
          width: 240,
          pointerEvents: "auto",
          bgcolor: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 1,
          backdropFilter: "blur(4px)",
          p: 1.25,
        }}
      >
        <BarReadout
          label="THR · スロットル"
          value={t.throttle}
          color={HUD_CYAN}
          tooltip="入力強度 (前後+上下+ヨーの合算)。ブースト中は 100% 表示"
        />
        <Box sx={{ height: 10 }} />
        <BarReadout
          label="BAT · バッテリ"
          value={t.battery}
          color={t.battery < 0.2 ? HUD_RED : t.battery < 0.4 ? HUD_AMBER : HUD_CYAN}
          tooltip="残量 (0% で操作不能になる想定だが現状は警告のみ)"
        />
      </Box>

      {/* Bottom-right: camera mode + control hint */}
      <Box
        sx={{
          position: "absolute",
          right: 24,
          bottom: 24,
          textAlign: "right",
          pointerEvents: "auto",
          bgcolor: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 1,
          backdropFilter: "blur(4px)",
          p: 1.25,
          maxWidth: 360,
        }}
      >
        <Typography variant="caption" sx={{ display: "block", color: HUD_DIM, letterSpacing: 2, fontSize: 10 }}>
          CAM · カメラ
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 600, letterSpacing: 4, color: HUD_CYAN, lineHeight: 1.1 }}>
          {cameraMode.toUpperCase()}
        </Typography>
        <Box sx={{ borderTop: `1px solid ${PANEL_BORDER}`, my: 1 }} />
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: HUD_CYAN,
            opacity: 0.95,
            lineHeight: 1.7,
            fontSize: 11,
            textAlign: "left",
          }}
        >
          <KeyHint k="WASD" /> / <KeyHint k="↑↓←→" /> = 前後・旋回<br />
          <KeyHint k="Q" /> / <KeyHint k="Space" /> = 上昇 &nbsp;
          <KeyHint k="E" /> / <KeyHint k="Ctrl" /> = 下降<br />
          <span style={{ color: HUD_AMBER, fontWeight: 600 }}>
            <KeyHint k="Shift" amber /> = ブースト ×2.5
          </span>
          <br />
          マウスドラッグ = 視点 / クリック = ピン<br />
          <KeyHint k="C" /> = カメラ &nbsp;
          <KeyHint k="R" /> = リセット &nbsp;
          <KeyHint k="Esc" /> = 一時停止
        </Typography>
      </Box>

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

// --- Sub-components ---------------------------------------------------------

function KeyHint({ k, amber }: { k: string; amber?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.6,
        mx: 0.15,
        bgcolor: "rgba(34, 211, 238, 0.12)",
        border: `1px solid ${amber ? HUD_AMBER : "rgba(34, 211, 238, 0.45)"}`,
        borderRadius: 0.5,
        fontFamily: "inherit",
        fontSize: 10,
        lineHeight: 1.4,
        color: amber ? HUD_AMBER : HUD_CYAN,
      }}
    >
      {k}
    </Box>
  );
}

function HeadingTape({ headingDeg }: { headingDeg: number }) {
  const ticks: { deg: number; label: string }[] = [];
  for (let d = -60; d <= 60; d += 10) {
    const tickDeg = (Math.round(headingDeg / 10) * 10 + d + 360) % 360;
    ticks.push({ deg: d, label: tickDeg.toString().padStart(3, "0") });
  }
  const cardinals: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

  return (
    <Tooltip
      title="HEADING · 機首方位 (0=北 / 90=東 / 180=南 / 270=西)。中央の▽が現在の向き。"
      placement="bottom"
      arrow
    >
      <Box
        sx={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: 480,
        }}
      >
        <Typography
          sx={{
            display: "block",
            fontSize: 10,
            letterSpacing: 3,
            color: HUD_DIM,
            textAlign: "center",
            mb: 0.5,
          }}
        >
          HEADING · 方位
        </Typography>
        <Box
          sx={{
            position: "relative",
            height: 56,
            border: `1px solid ${PANEL_BORDER}`,
            bgcolor: PANEL_BG,
            backdropFilter: "blur(4px)",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          {ticks.map((tick, i) => {
            const x = 240 + (tick.deg / 60) * 240;
            const isMajor = parseInt(tick.label, 10) % 30 === 0;
            const cardinal = cardinals[parseInt(tick.label, 10)];
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
                  <Typography sx={{ fontSize: 13, lineHeight: 1.2, mt: 0.25, color: HUD_CYAN }}>
                    {cardinal ?? tick.label}
                  </Typography>
                )}
              </Box>
            );
          })}
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
      </Box>
    </Tooltip>
  );
}

function AttitudeIndicator({ pitchDeg, rollDeg }: { pitchDeg: number; rollDeg: number }) {
  const SIZE = 180;
  const pitchOffset = pitchDeg * 2;

  return (
    <Tooltip
      title="ATTITUDE · 姿勢計 (人工水平儀)。中央の橙線が機体軸、シアンの線が水平線。傾き=ロール、上下ずれ=ピッチ。"
      placement="top"
      arrow
    >
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          width: SIZE,
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            letterSpacing: 3,
            color: HUD_DIM,
            textAlign: "center",
            mb: 0.5,
          }}
        >
          ATTITUDE · 姿勢
        </Typography>
        <Box
          sx={{
            width: SIZE,
            height: SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            border: `1px solid ${PANEL_BORDER}`,
            bgcolor: PANEL_BG,
            backdropFilter: "blur(4px)",
            position: "relative",
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
            <Box
              sx={{
                position: "absolute",
                left: -SIZE / 2,
                right: -SIZE / 2,
                top: SIZE / 2 + pitchOffset,
                height: SIZE * 2,
                background: `linear-gradient(to bottom, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.06) 100%)`,
                borderTop: `1.5px solid ${HUD_CYAN}`,
              }}
            />
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
      </Box>
    </Tooltip>
  );
}

function TelemetryPanel({
  sx,
  label,
  value,
  sub,
  align = "left",
  tooltip,
}: {
  sx: object;
  label: string;
  value: string;
  sub?: string;
  align?: "left" | "right";
  tooltip?: string;
}) {
  return (
    <Tooltip title={tooltip ?? ""} placement={align === "right" ? "left" : "right"} arrow>
      <Box
        sx={{
          position: "absolute",
          textAlign: align,
          pointerEvents: "auto",
          bgcolor: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 1,
          backdropFilter: "blur(4px)",
          px: 1.5,
          py: 1,
          minWidth: 150,
          ...sx,
        }}
      >
        <Typography variant="caption" sx={{ display: "block", color: HUD_DIM, letterSpacing: 2, fontSize: 10 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
            color: HUD_CYAN,
          }}
        >
          {value}
        </Typography>
        {sub && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: HUD_DIM,
              mt: 0.25,
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {sub}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

function BarReadout({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: number;
  color: string;
  tooltip?: string;
}) {
  return (
    <Tooltip title={tooltip ?? ""} placement="right" arrow>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: HUD_DIM, letterSpacing: 1, fontSize: 10 }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color, fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
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
    </Tooltip>
  );
}
