import type { NextConfig } from "next";

// Stockly is an authenticated app where almost every page is per-user and
// dynamic, so we use the classic request-time rendering model instead of
// Cache Components / Partial Prefetching.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Photos are resized in the browser before upload, but leave headroom.
      bodySizeLimit: "10mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
