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
};

export default nextConfig;
