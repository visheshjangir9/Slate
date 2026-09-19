import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Never render the dev overlay in a shipped build.
  devIndicators: false,
  /* config options here */
};

export default nextConfig;
