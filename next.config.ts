import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loopback access used by local browser checks; keep remote origins explicit.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
