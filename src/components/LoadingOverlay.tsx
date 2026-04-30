"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useSimStore } from "@/store/sim-store";

const HUD_CYAN = "#22d3ee";
const HUD_DIM = "rgba(34, 211, 238, 0.55)";
const HUD_RED = "#f87171";

export default function LoadingOverlay() {
  const ready = useSimStore((s) => s.tilesetReady);
  const error = useSimStore((s) => s.tilesetError);

  if (ready && !error) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(0, 8, 12, 0.88)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
        color: HUD_CYAN,
        textAlign: "center",
        px: 4,
      }}
    >
      <Typography sx={{ fontSize: 11, letterSpacing: 6, color: HUD_DIM, mb: 1 }}>
        GOOGLE PHOTOREALISTIC 3D TILES
      </Typography>

      {error ? (
        <>
          <Typography sx={{ color: HUD_RED, fontSize: 22, letterSpacing: 1, mb: 2 }}>
            タイルの読み込みに失敗しました
          </Typography>
          <Typography sx={{ color: HUD_DIM, fontSize: 13, maxWidth: 560, lineHeight: 1.7 }}>
            <code style={{ color: HUD_CYAN }}>.env.local</code> に
            <code style={{ color: HUD_CYAN }}>NEXT_PUBLIC_CESIUM_ION_TOKEN</code>
            が設定されているか、トークンが有効か確認してください。
            <br />
            設定後は dev サーバーの再起動が必要です。
          </Typography>
          <Typography
            sx={{
              color: HUD_DIM,
              fontSize: 11,
              mt: 3,
              maxWidth: 720,
              opacity: 0.6,
              wordBreak: "break-all",
            }}
          >
            {error}
          </Typography>
        </>
      ) : (
        <>
          <CircularProgress size={56} thickness={2} sx={{ color: HUD_CYAN, mb: 4 }} />
          <Typography sx={{ fontSize: 18, letterSpacing: 3, mb: 1 }}>
            タイルストリーム接続中
          </Typography>
          <Typography sx={{ color: HUD_DIM, fontSize: 12, maxWidth: 480, lineHeight: 1.7 }}>
            Google Maps Platform から世界の写実 3D メッシュを Cesium ion 経由で受信しています。
            <br />
            最初のタイルが表示されるまで数秒お待ちください。
          </Typography>
        </>
      )}
    </Box>
  );
}
