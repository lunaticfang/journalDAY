import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
