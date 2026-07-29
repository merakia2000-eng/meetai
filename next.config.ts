import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ 核心修复：关闭字体优化。这样打包时就不会去连外网下字体，彻底解决之前的报错。
  optimizeFonts: false,

  // 保持你原有的配置
  experimental: {
    typedRoutes: true,
  },
} as any;

export default nextConfig;