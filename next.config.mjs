/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Cesium internals don't love double-mount; turn off for the viewer
  webpack: (config) => {
    // Cesium ships some Node-style requires; keep webpack from trying to polyfill them.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, http: false, https: false, zlib: false };
    return config;
  },
};

export default nextConfig;
