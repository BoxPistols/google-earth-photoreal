"use client";

import dynamic from "next/dynamic";
import { Box } from "@mui/material";

// Cesium uses window/document at module scope — must be client-only.
const Simulator = dynamic(() => import("@/components/Simulator"), { ssr: false });
const HUD = dynamic(() => import("@/components/HUD"), { ssr: false });

export default function Page() {
  return (
    <Box sx={{ position: "fixed", inset: 0 }}>
      <Simulator />
      <HUD />
    </Box>
  );
}
