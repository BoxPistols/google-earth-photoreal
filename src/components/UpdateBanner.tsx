"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const HUD_AMBER = "#fbbf24";
const HUD_DIM = "rgba(251, 191, 36, 0.7)";
const POLL_MS = 30_000;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function fetchBuildId(): Promise<string | null> {
  try {
    const url = `${basePath}/build-info.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

export default function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    fetchBuildId().then((id) => {
      if (cancelled) return;
      initialIdRef.current = id;
    });

    interval = window.setInterval(async () => {
      const id = await fetchBuildId();
      if (cancelled) return;
      if (id && initialIdRef.current && id !== initialIdRef.current) {
        setHasUpdate(true);
        if (interval !== null) window.clearInterval(interval);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);

  if (!hasUpdate) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 95,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: "rgba(0, 8, 12, 0.92)",
        border: `1px solid ${HUD_AMBER}`,
        borderRadius: 1,
        backdropFilter: "blur(4px)",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <Typography sx={{ color: HUD_DIM, fontSize: 12, letterSpacing: 1 }}>
        新しいバージョンがあります
      </Typography>
      <Button
        onClick={() => window.location.reload()}
        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
        size="small"
        sx={{
          color: HUD_AMBER,
          border: `1px solid ${HUD_AMBER}`,
          fontFamily: "inherit",
          fontSize: 12,
          textTransform: "none",
          py: 0.25,
          "&:hover": {
            bgcolor: "rgba(251, 191, 36, 0.12)",
            borderColor: HUD_AMBER,
          },
        }}
      >
        リロード
      </Button>
    </Box>
  );
}
