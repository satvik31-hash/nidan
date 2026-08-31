import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions carry the case-sheet autosave payload; 60 fields of JSONB
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
