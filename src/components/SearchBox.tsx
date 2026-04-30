"use client";

import { useState } from "react";
import { Box, TextField, Typography, CircularProgress } from "@mui/material";
import { searchAndTeleport } from "@/lib/sim-handle";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.55)";
const HUD_RED = "#f87171";

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const submit = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const hit = await searchAndTeleport(q);
      if (!hit) {
        setError("見つかりませんでした");
        setLast(null);
      } else {
        setLast(hit.displayName);
      }
    } catch (e) {
      console.error(e);
      setError("検索に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        left: 24,
        width: 320,
        pointerEvents: "auto",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
      }}
    >
      <TextField
        size="small"
        fullWidth
        placeholder="場所を検索 (例: 東京タワー / Skytree / Eiffel Tower)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          // Don't let typing into the box drive the drone
          e.stopPropagation();
        }}
        disabled={busy}
        slotProps={{
          input: {
            endAdornment: busy ? (
              <CircularProgress size={16} sx={{ color: HUD_CYAN }} />
            ) : null,
            sx: {
              color: HUD_CYAN,
              bgcolor: "rgba(0, 8, 12, 0.65)",
              backdropFilter: "blur(2px)",
              fontFamily: "inherit",
              fontSize: 14,
              "& fieldset": { borderColor: HUD_DIM },
              "&:hover fieldset": { borderColor: HUD_CYAN },
              "&.Mui-focused fieldset": { borderColor: `${HUD_CYAN} !important` },
            },
          },
        }}
      />
      {error && (
        <Typography variant="caption" sx={{ color: HUD_RED, mt: 0.5, display: "block" }}>
          {error}
        </Typography>
      )}
      {last && !error && (
        <Typography variant="caption" sx={{ color: HUD_DIM, mt: 0.5, display: "block" }}>
          → {last}
        </Typography>
      )}
    </Box>
  );
}
