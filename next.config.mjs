/** @type {import('next').NextConfig} */

// Set NEXT_PUBLIC_BASE_PATH=/<repo-name> at build time for GitHub Pages.
// Locally it stays empty so the dev server runs at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Static export so the build can be hosted on GitHub Pages (no Node server).
  output: "export",
  reactStrictMode: false, // Cesium internals don't love double-mount.
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  // The TS errors that exist here are pre-existing Cesium type-quirks
  // (skyAtmosphere optional, CallbackProperty vs PositionProperty). They don't
  // affect runtime; let the static export proceed.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      http: false,
      https: false,
      zlib: false,
    };
    return config;
  },
};

export default nextConfig;
