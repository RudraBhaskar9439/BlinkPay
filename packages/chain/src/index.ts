import { createPublicClient, defineChain, http, type Address } from "viem";

export const MONAD_MAINNET_RPC_URL = "https://rpc.monad.xyz";
export const MONAD_TESTNET_RPC_URL = "https://testnet-rpc.monad.xyz";

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://monadscan.com" },
  },
});

export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Monad Testnet Explorer", url: "https://testnet.monadscan.com" },
  },
  testnet: true,
});

export const usdcAddresses = {
  mainnet: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  testnet: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
} as const satisfies Record<MonadNetwork, Address>;

export type MonadNetwork = "mainnet" | "testnet";

export function getMonadRpcUrl(network: MonadNetwork): string {
  if (network === "mainnet") {
    return process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? MONAD_MAINNET_RPC_URL;
  }

  return process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL ?? MONAD_TESTNET_RPC_URL;
}

export function createMonadPublicClient(
  network: MonadNetwork,
  rpcUrl = getMonadRpcUrl(network),
) {
  const chain = network === "mainnet" ? monadMainnet : monadTestnet;

  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 10_000 }),
  });
}
