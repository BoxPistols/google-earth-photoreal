import type { Metadata } from "next";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";
import ThemeRegistry from "./ThemeRegistry";

export const metadata: Metadata = {
  title: "Drone Flight Sim",
  description: "Photorealistic drone flight simulator built on Cesium + Google 3D Tiles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
