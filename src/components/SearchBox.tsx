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
import { MOD_LABEL, isModKey, isComposingEvent } from "@/lib/os";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.6)";
const HUD_RED = "#f87171";
const HUD_AMBER = "#fbbf24";

const HISTORY_KEY = "geph.searchHistory";
const HISTORY_LIMIT = 10;
const DEBOUNCE_MS = 320;
// Plain Enter waits this long before submitting so an IME compositionend
// (or a quick follow-up keystroke) can cancel/replace it.
const ENTER_DELAY_MS = 280;

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
    /* quota / private mode — ignore */
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
  const [pendingEnter, setPendingEnter] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load saved history once
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Cmd/Ctrl + K → focus the search input. Skip when already typing in an
  // input/textarea so it doesn't fight the user's text editing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k") return;
      if (!isModKey(e)) return;
      const tgt = e.target as HTMLElement | null;
      const typing =
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable);
      if (typing && tgt !== inputRef.current) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced autocomplete
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

  const cancelPendingEnter = () => {
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    setPendingEnter(false);
  };

  const onPick = (hit: GeocodeHit) => {
    cancelPendingEnter();
    flyToHit(hit);
    const next = pushToHistory(history, hit);
    setHistory(next);
    saveHistory(next);
    setQuery("");
    setResults([]);
    setFocused(false);
    inputRef.current?.blur();
  };

  const onClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory([]);
    saveHistory([]);
  };

  const submitFirst = () => {
    if (results.length > 0) onPick(results[0]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Never act on keystrokes that belong to IME composition.
    if (isComposingEvent(e)) return;

    if (e.key === "Escape") {
      cancelPendingEnter();
      setQuery("");
      setFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key !== "Enter") return;

    // Cmd/Ctrl + Enter → instant submit (overrides any pending delayed submit).
    if (isModKey(e)) {
      e.preventDefault();
      cancelPendingEnter();
      submitFirst();
      return;
    }

    // Plain Enter → schedule a delayed submit. A second Enter inside the window
    // also reschedules, which is harmless. Typing more cancels.
    e.preventDefault();
    cancelPendingEnter();
    setPendingEnter(true);
    enterTimerRef.current = window.setTimeout(() => {
      enterTimerRef.current = null;
      setPendingEnter(false);
      submitFirst();
    }, ENTER_DELAY_MS);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    cancelPendingEnter();
    setQuery(e.target.value);
  };

  // Cancel the pending Enter on IME activity too — a user mid-composition who
  // hits Enter to confirm a candidate must not also trigger a search.
  const onCompositionStart = () => cancelPendingEnter();
  const onCompositionEnd = () => cancelPendingEnter();

  const showDropdown =
    focused && (query.trim() ? results.length > 0 || busy || error : history.length > 0);

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        left: 24,
        width: 380,
        pointerEvents: "auto",
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
      }}
    >
      <TextField
        size="small"
        fullWidth
        inputRef={inputRef}
        placeholder={`場所を検索  (${MOD_LABEL}+K で開く)`}
        value={query}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        slotProps={{
          input: {
            endAdornment: busy ? (
              <CircularProgress size={16} sx={{ color: HUD_CYAN }} />
            ) : pendingEnter ? (
              <Typography sx={{ fontSize: 10, color: HUD_AMBER, letterSpacing: 1 }}>
                確定中…
              </Typography>
            ) : null,
            sx: {
              color: HUD_CYAN,
              bgcolor: "rgba(0, 8, 12, 0.78)",
              backdropFilter: "blur(4px)",
              fontFamily: "inherit",
              fontSize: 14,
              "& fieldset": { borderColor: "rgba(34, 211, 238, 0.3)" },
              "&:hover fieldset": { borderColor: HUD_CYAN },
              "&.Mui-focused fieldset": { borderColor: `${HUD_CYAN} !important` },
            },
          },
        }}
      />

      {/* Helper text — only when focused, doesn't shift layout when collapsed */}
      {focused && (
        <Typography
          sx={{
            mt: 0.5,
            fontFamily: "inherit",
            fontSize: 10,
            color: HUD_DIM,
            lineHeight: 1.6,
          }}
        >
          <KeyTag>Enter</KeyTag> で検索 (約 0.3 秒待ち) ・
          <KeyTag>{MOD_LABEL}+Enter</KeyTag> で即時 ・
          <KeyTag>Esc</KeyTag> で閉じる
          <br />
          ※ 日本語入力中の Enter は変換確定として扱い、検索しません
        </Typography>
      )}

      {showDropdown && (
        <Box
          sx={{
            mt: 0.75,
            border: `1px solid rgba(34, 211, 238, 0.3)`,
            borderRadius: 1,
            bgcolor: "rgba(0, 8, 12, 0.92)",
            backdropFilter: "blur(6px)",
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

          {!query.trim() && history.length > 0 && (
            <>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: `1px solid rgba(34, 211, 238, 0.2)`,
                }}
              >
                <Typography sx={{ color: HUD_DIM, fontSize: 10, letterSpacing: 2 }}>
                  RECENT · 履歴
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

          {query.trim() && results.length > 0 && (
            <>
              <Box sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid rgba(34, 211, 238, 0.2)` }}>
                <Typography sx={{ color: HUD_DIM, fontSize: 10, letterSpacing: 2 }}>
                  {results.length} 件 ・ Enter で先頭、クリックで個別選択
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

function KeyTag({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.5,
        mx: 0.25,
        bgcolor: "rgba(34, 211, 238, 0.12)",
        border: `1px solid rgba(34, 211, 238, 0.45)`,
        borderRadius: 0.5,
        fontFamily: "inherit",
        fontSize: 9.5,
        color: HUD_CYAN,
      }}
    >
      {children}
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
        <Typography sx={{ fontFamily: "inherit", fontSize: 10, color: HUD_DIM }}>
          {hit.lat.toFixed(4)}, {hit.lon.toFixed(4)}
        </Typography>
      </Box>
    </Box>
  );
}
