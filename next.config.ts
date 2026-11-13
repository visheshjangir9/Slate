import type { NextConfig } from "next";
import { HSTS_VALUE } from "./src/lib/security/https";

const production = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: only this site, Supabase Storage (where results
 * live) and Razorpay Checkout may supply scripts, media, frames or
 * connections. 'unsafe-inline' scripts stay allowed because the intro's
 * pre-hydration script and Next's static pages need it (a nonce would make
 * every page dynamic); every other XSS route is closed: no foreign script
 * hosts, no plugins, no <base> hijack, no framing, forms post only here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://va.vercel-scripts.com${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.razorpay.com",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.razorpay.com https://va.vercel-scripts.com",
  "frame-src https://*.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** Hardening for every response. */
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Force HTTPS in the browser too: after one HTTPS visit, http:// is never tried again.
  ...(production ? [{ key: "Strict-Transport-Security", value: HSTS_VALUE }] : []),
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
