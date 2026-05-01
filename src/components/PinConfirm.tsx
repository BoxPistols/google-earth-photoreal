"use client";

import { Box, Button, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import { useSimStore } from "@/store/sim-store";
import { flyToHit } from "@/lib/sim-handle";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.55)";
const HUD_AMBER = "#fbbf24";

export default function PinConfirm() {
  const pin = useSimStore((s) => s.pendingPin);
  const setPendingPin = useSimStore((s) => s.setPendingPin);

  if (!pin) return null;

  const onConfirm = () => {
    flyToHit(
      { displayName: pin.label ?? "クリック地点", lon: pin.lon, lat: pin.lat },
      pin.altitude,
    );
    setPendingPin(null);
  };

  const onCancel = () => setPendingPin(null);

  // Anchor the bubble above the click and let it grow upward — keeps the pin
  // dot uncovered. Clamp to viewport so it stays visible at edges.
  const W = 220;
  const left = Math.min(
    Math.max(pin.clientX - W / 2, 8),
    window.innerWidth - W - 8,
  );
  const top = Math.max(pin.clientY - 96, 8);

  return (
    <Box
      sx={{
        position: "absolute",
        left,
        top,
        width: W,
        pointerEvents: "auto",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
        bgcolor: "rgba(0, 8, 12, 0.9)",
        border: `1px solid ${HUD_AMBER}`,
        borderRadius: 1,
        p: 1.25,
        zIndex: 90,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: HUD_AMBER, fontSize: 11, letterSpacing: 2, mb: 0.25 }}>
            PIN
          </Typography>
          <Typography
            sx={{
              color: HUD_CYAN,
              fontSize: 12,
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}
          </Typography>
          <Typography sx={{ color: HUD_DIM, fontSize: 10 }}>
            高度 {Math.round(pin.altitude)} m
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onCancel}
          sx={{ color: HUD_DIM, "&:hover": { color: HUD_CYAN } }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Button
        onClick={onConfirm}
        startIcon={<FlightTakeoffIcon />}
        fullWidth
        sx={{
          color: HUD_AMBER,
          bgcolor: "rgba(251, 191, 36, 0.08)",
          border: `1px solid ${HUD_AMBER}`,
          fontFamily: "inherit",
          fontSize: 12,
          letterSpacing: 1,
          textTransform: "none",
          py: 0.75,
          "&:hover": {
            bgcolor: "rgba(251, 191, 36, 0.18)",
            borderColor: HUD_AMBER,
          },
        }}
      >
        ここへ移動
      </Button>
    </Box>
  );
}
