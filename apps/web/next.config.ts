import { config } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// Keep one ignored environment file at the monorepo root for local development.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@blinkpay/chain",
    "@blinkpay/core",
    "@blinkpay/planner",
    "@blinkpay/policy",
    "@blinkpay/zerox",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
