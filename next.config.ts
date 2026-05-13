import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Tauri expects a static build in ./out
  trailingSlash: true,
};

export default nextConfig;
