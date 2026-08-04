import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  optimizeFonts: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/meetings",
        permanent: false,
      },
    ];
  },
}as any;

export default nextConfig;