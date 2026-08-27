import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@richfeed/ui", "@richfeed/shared"],
};

export default nextConfig;
