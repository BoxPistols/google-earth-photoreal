"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import PlaceIcon from "@mui/icons-material/Place";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { flyToHit, searchPlaces, type GeocodeHit } from "@/lib/sim-handle";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.55)";
const HUD_RED = "#f87171";

const HISTORY_KEY = "geph.searchHistory";
const HISTORY_LIMIT = 10;
const DEBOUNCE_MS = 320;

function loadHistory(): GeocodeHit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: GeocodeHit[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {
    /* ignore quota */
  }
}

function pushToHistory(prev: GeocodeHit[], hit: GeocodeHit): GeocodeHit[] {
  const dedup = prev.filter((h) => h.displayName !== hit.displayName);
  return [hit, ...dedup].slice(0, HISTORY_LIMIT);
}

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [history, setHistory] = useState<GeocodeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  // Initial history load
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Debounced autocomplete on query change
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setBusy(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const myReqId = ++reqIdRef.current;
      setBusy(true);
      setError(null);
      try {
        const hits = await searchPlaces(q);
        // Drop stale responses (user kept typing)
        if (myReqId !== reqIdRef.current) return;
        setResults(hits);
      } catch (e) {
        if (myReqId !== reqIdRef.current) return;
        console.error(e);
        setError("検索に失敗しました");
        setResults([]);
      } finally {
        if (myReqId === reqIdRef.current) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const onPick = (hit: GeocodeHit) => {
    flyToHit(hit);
    const next = pushToHistory(history, hit);
    setHistory(next);
    saveHistory(next);
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  const onClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory([]);
    saveHistory([]);
  };

  const onEnter = () => {
    if (results.length > 0) onPick(results[0]);
  };

  const showDropdown =
    focused && (query.trim() ? results.length > 0 || busy || error : history.length > 0);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        left: 24,
        width: 360,
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
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
          if (e.key === "Escape") {
            setQuery("");
            setFocused(false);
          }
        }}
        slotProps={{
          input: {
            endAdornment: busy ? (
              <CircularProgress size={16} sx={{ color: HUD_CYAN }} />
            ) : null,
            sx: {
              color: HUD_CYAN,
              bgcolor: "rgba(0, 8, 12, 0.7)",
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

      {showDropdown && (
        <Box
          sx={{
            mt: 0.5,
            border: `1px solid ${HUD_DIM}`,
            borderRadius: 1,
            bgcolor: "rgba(0, 8, 12, 0.85)",
            backdropFilter: "blur(4px)",
            overflow: "hidden",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {error && (
            <Typography sx={{ color: HUD_RED, fontSize: 12, px: 1.5, py: 1 }}>
              {error}
            </Typography>
          )}

          {/* Recent history (visible only when query is empty) */}
          {!query.trim() && history.length > 0 && (
            <>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: `1px solid ${HUD_DIM}`,
                }}
              >
                <Typography sx={{ color: HUD_DIM, fontSize: 10, letterSpacing: 2 }}>
                  RECENT
                </Typography>
                <IconButton
                  size="small"
                  onClick={onClearHistory}
                  onMouseDown={(e) => e.preventDefault()}
                  sx={{ color: HUD_DIM, "&:hover": { color: HUD_RED } }}
                  title="履歴をクリア"
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              {history.map((h, i) => (
                <Row
                  key={`h-${i}-${h.displayName}`}
                  hit={h}
                  icon={<HistoryIcon sx={{ fontSize: 14, color: HUD_DIM }} />}
                  onClick={() => onPick(h)}
                />
              ))}
            </>
          )}

          {/* Search results */}
          {query.trim() && results.length > 0 && (
            <>
              <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${HUD_DIM}` }}>
                <Typography sx={{ color: HUD_DIM, fontSize: 10, letterSpacing: 2 }}>
                  {results.length}件の候補 (Enterで先頭を選択)
                </Typography>
              </Box>
              {results.map((h, i) => (
                <Row
                  key={`r-${i}-${h.displayName}`}
                  hit={h}
                  icon={<PlaceIcon sx={{ fontSize: 14, color: HUD_CYAN }} />}
                  onClick={() => onPick(h)}
                />
              ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function Row({
  hit,
  icon,
  onClick,
}: {
  hit: GeocodeHit;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Box
      // mousedown fires before blur so the row click registers before the
      // dropdown collapses on focus loss.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        cursor: "pointer",
        color: HUD_CYAN,
        fontSize: 13,
        "&:hover": { bgcolor: "rgba(34, 211, 238, 0.1)" },
        borderBottom: "1px solid rgba(34, 211, 238, 0.08)",
        "&:last-child": { borderBottom: "none" },
      }}
    >
      {icon}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: "inherit",
            fontSize: 13,
            color: HUD_CYAN,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hit.displayName}
        </Typography>
        <Typography
          sx={{
            fontFamily: "inherit",
            fontSize: 10,
            color: HUD_DIM,
          }}
        >
          {hit.lat.toFixed(4)}, {hit.lon.toFixed(4)}
        </Typography>
      </Box>
    </Box>
  );
}
