import { activeMonadChain } from "@blinkpay/chain";
import {
  createWalletClient,
  custom,
  getAddress,
  isAddress,
  type Address,
  type EIP1193Provider,
} from "viem";

type BrowserWithEthereum = Window & { ethereum?: EIP1193Provider };

export function getConfiguredRouterAddress(): Address {
  const value = process.env.NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS;
  if (!value || !isAddress(value, { strict: true })) {
    throw new Error("BlinkPay router is not configured for this deployment");
  }
  return getAddress(value);
}

export function getConfiguredTestnetPoolAddress(): Address {
  const value = process.env.NEXT_PUBLIC_BLINKPAY_TESTNET_POOL_ADDRESS;
  if (!value || !isAddress(value, { strict: true })) {
    throw new Error("BlinkPay testnet pool is not configured for this deployment");
  }
  return getAddress(value);
}

export function formatAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export async function connectInjectedWallet() {
  const provider = getInjectedProvider();
  await ensureMonad(provider);

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !isAddress(accounts[0])) {
    throw new Error("Wallet did not return a valid account");
  }

  const account = getAddress(accounts[0]);
  const walletClient = createWalletClient({
    account,
    chain: activeMonadChain,
    transport: custom(provider),
  });

  return { account, walletClient };
}

function getInjectedProvider(): EIP1193Provider {
  if (typeof window === "undefined") throw new Error("Wallet access requires a browser");
  const provider = (window as BrowserWithEthereum).ethereum;
  if (!provider) throw new Error("No injected wallet found. Install MetaMask or another EVM wallet.");
  return provider;
}

async function ensureMonad(provider: EIP1193Provider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${activeMonadChain.id.toString(16)}` }],
    });
  } catch (error) {
    if (!isProviderError(error) || error.code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${activeMonadChain.id.toString(16)}`,
          chainName: activeMonadChain.name,
          nativeCurrency: activeMonadChain.nativeCurrency,
          rpcUrls: activeMonadChain.rpcUrls.default.http,
          blockExplorerUrls: [activeMonadChain.blockExplorers.default.url],
        },
      ],
    });
  }
}

function isProviderError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const firstLine = error.message.split("\n")[0];
    return firstLine || "Wallet request failed";
  }
  return "Wallet request failed";
}
