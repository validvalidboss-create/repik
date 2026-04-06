import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Next uses this folder as the workspace root when multiple lockfiles exist
  // (silences the warning and fixes 404 from wrong root)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
