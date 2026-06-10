import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server bundle with only the
  // dependencies actually imported, used by the production Docker image.
  output: "standalone",
};

export default nextConfig;
