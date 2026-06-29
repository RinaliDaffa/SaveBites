import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Security headers ───────────────────────────────────────────────
  // These are layered on top of the middleware-injected headers for
  // resilience. Middleware covers dynamic routes; this catches edge
  // cases like stale CDN caches and fallback routes.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300",
          },
        ],
      },
      // API routes get stricter caching controls.
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
