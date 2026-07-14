import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@blinkpay/chain", "@blinkpay/core", "@blinkpay/zerox"],
};

export default nextConfig;
