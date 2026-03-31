import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `http://147.15.88.123:8000/:path*`,
      },
    ];
  },
};

export default nextConfig;
