import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV import caps files at 2 MB; leave room for multipart overhead (Next's default is 1 MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
