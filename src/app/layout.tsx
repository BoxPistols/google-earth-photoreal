import type { Metadata, Viewport } from "next";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./globals.css";
import ThemeRegistry from "./ThemeRegistry";

const siteName = "Drone Flight Sim";
const description =
  "Photorealistic drone flight simulator built on Cesium + Google Photorealistic 3D Tiles. Fly anywhere on Earth in your browser.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drone-sim.local";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  generator: "Next.js",
  keywords: [
    "drone",
    "flight simulator",
    "Cesium",
    "Google 3D Tiles",
    "Photorealistic 3D Tiles",
    "WebGL",
    "ドローン",
    "フライトシミュレーター",
  ],
  authors: [{ name: "Drone Flight Sim" }],
  creator: "Drone Flight Sim",
  publisher: "Drone Flight Sim",
  category: "simulation",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: {
      ja: "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName,
    title: siteName,
    description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b1220" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
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
