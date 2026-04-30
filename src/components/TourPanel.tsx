"use client";

import { Box, Button, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { useSimStore } from "@/store/sim-store";
import { startTour, stopTour } from "@/lib/sim-handle";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.55)";
const HUD_AMBER = "#fbbf24";

export default function TourPanel() {
  const active = useSimStore((s) => s.tourActive);
  const name = useSimStore((s) => s.tourLandmarkName);
  const ready = useSimStore((s) => s.tilesetReady);

  const onClick = () => {
    if (active) stopTour();
    else startTour();
  };

  return (
    <Box
      sx={{
        position: "absolute",
        top: 88,
        left: 24,
        width: 320,
        pointerEvents: "auto",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
      }}
    >
      <Button
        onClick={onClick}
        disabled={!ready}
        startIcon={active ? <StopIcon /> : <PlayArrowIcon />}
        fullWidth
        sx={{
          color: active ? HUD_AMBER : HUD_CYAN,
          bgcolor: "rgba(0, 8, 12, 0.65)",
          backdropFilter: "blur(2px)",
          border: `1px solid ${active ? HUD_AMBER : HUD_DIM}`,
          fontFamily: "inherit",
          fontSize: 13,
          letterSpacing: 1,
          justifyContent: "flex-start",
          textTransform: "none",
          py: 1,
          "&:hover": {
            borderColor: active ? HUD_AMBER : HUD_CYAN,
            bgcolor: "rgba(0, 8, 12, 0.85)",
          },
          "&.Mui-disabled": {
            color: "rgba(34, 211, 238, 0.3)",
            borderColor: "rgba(34, 211, 238, 0.15)",
          },
        }}
      >
        {active ? `自動ツアー停止` : `自動ツアー開始 (Tokyo)`}
      </Button>
      {active && name && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.75,
            color: HUD_DIM,
            fontFamily: "inherit",
          }}
        >
          → 現在地: <span style={{ color: HUD_CYAN }}>{name}</span>
        </Typography>
      )}
    </Box>
  );
}
