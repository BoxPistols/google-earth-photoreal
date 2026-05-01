"use client";

import dynamic from "next/dynamic";
import { Box } from "@mui/material";

// Cesium uses window/document at module scope — must be client-only.
const Simulator = dynamic(() => import("@/components/Simulator"), { ssr: false });
const HUD = dynamic(() => import("@/components/HUD"), { ssr: false });
const SearchBox = dynamic(() => import("@/components/SearchBox"), { ssr: false });
const TourPanel = dynamic(() => import("@/components/TourPanel"), { ssr: false });
const PinConfirm = dynamic(() => import("@/components/PinConfirm"), { ssr: false });
const LoadingOverlay = dynamic(() => import("@/components/LoadingOverlay"), { ssr: false });

export default function Page() {
  return (
    <Box sx={{ position: "fixed", inset: 0 }}>
      <Simulator />
      <HUD />
      <SearchBox />
      <TourPanel />
      <PinConfirm />
      <LoadingOverlay />
    </Box>
  );
}
