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

export const wmonAddresses = {
  mainnet: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  testnet: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
} as const satisfies Record<MonadNetwork, Address>;

export const zeroExAllowanceHolderAddresses = {
  mainnet: "0x0000000000001fF3684f28c67538d4D072C22734",
} as const;

export type MonadNetwork = "mainnet" | "testnet";

export function getActiveMonadNetwork(): MonadNetwork {
  return process.env.NEXT_PUBLIC_MONAD_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export const activeMonadNetwork = getActiveMonadNetwork();
export const activeMonadChain = activeMonadNetwork === "mainnet" ? monadMainnet : monadTestnet;
export const activeUsdcAddress = usdcAddresses[activeMonadNetwork];
export const activeWmonAddress = wmonAddresses[activeMonadNetwork];

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
