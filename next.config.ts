import type { NextConfig } from "next";
import { HSTS_VALUE } from "./src/lib/security/https";

/** Baseline hardening for every response. No CSP yet: it needs an audit of inline scripts and media hosts first. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Force HTTPS in the browser too: after one HTTPS visit, http:// is never tried again.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: HSTS_VALUE }] : []),
];

/** Static artwork and clips: reuse for a day, then revalidate in the background for up to a week. */
const mediaCache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig: NextConfig = {
  // Never render the dev overlay in a shipped build.
  devIndicators: false,
  poweredByHeader: false,
  images: {
    // Only the static artwork is resized by the optimizer; nothing else can be fed to it.
    localPatterns: [{ pathname: "/explore/**", search: "" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/explore/:file*", headers: mediaCache },
      { source: "/media/:file*", headers: mediaCache },
    ];
  },
};

export default nextConfig;
