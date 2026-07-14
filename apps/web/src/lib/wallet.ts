import {
  activeMonadChain,
  activeMonadNetwork,
  blinkPayTestnetDeployment,
} from "@blinkpay/chain";
import {
  createWalletClient,
  custom,
  getAddress,
  isAddress,
  type Address,
  type EIP1193Provider,
} from "viem";

type AccountListener = (account: Address | undefined) => void;
type InjectedProvider = EIP1193Provider & {
  on?: (event: "accountsChanged", listener: (accounts: unknown) => void) => void;
  removeListener?: (event: "accountsChanged", listener: (accounts: unknown) => void) => void;
};
type BrowserWithEthereum = Window & { ethereum?: InjectedProvider };

export function getConfiguredRouterAddress(): Address {
  const value = process.env.NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS
    ?? (activeMonadNetwork === "testnet" ? blinkPayTestnetDeployment.router : undefined);
  if (!value || !isAddress(value, { strict: true })) {
    throw new Error("BlinkPay router is not configured for this deployment");
  }
  return getAddress(value);
}

export function getConfiguredTestnetPoolAddress(): Address {
  const value = process.env.NEXT_PUBLIC_BLINKPAY_TESTNET_POOL_ADDRESS
    ?? (activeMonadNetwork === "testnet" ? blinkPayTestnetDeployment.pool : undefined);
  if (!value || !isAddress(value, { strict: true })) {
    throw new Error("BlinkPay testnet pool is not configured for this deployment");
  }
  return getAddress(value);
}

export function getConfiguredVaultAddress(): Address {
  const deployment = blinkPayTestnetDeployment as typeof blinkPayTestnetDeployment & {
    vault?: Address;
  };
  const value = process.env.NEXT_PUBLIC_BLINKPAY_VAULT_ADDRESS
    ?? (activeMonadNetwork === "testnet" ? deployment.vault : undefined);
  if (!value || !isAddress(value, { strict: true })) {
    throw new Error("BlinkPay ERC-4626 vault is not configured for this deployment");
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
  const account = getPrimaryAccount(accounts);
  if (!account) {
    throw new Error("Wallet did not return a valid account");
  }

  const walletClient = createWalletClient({
    account,
    chain: activeMonadChain,
    transport: custom(provider),
  });

  return { account, walletClient };
}

/// Keeps UI state synchronized with MetaMask account switches and disconnects.
export function watchInjectedAccount(listener: AccountListener): () => void {
  if (typeof window === "undefined") return () => undefined;
  const provider = (window as BrowserWithEthereum).ethereum;
  if (!provider) return () => undefined;

  let active = true;
  let accountEventReceived = false;
  const handleAccountsChanged = (accounts: unknown) => {
    accountEventReceived = true;
    if (active) listener(getPrimaryAccount(accounts));
  };

  provider.on?.("accountsChanged", handleAccountsChanged);
  void provider.request({ method: "eth_accounts" })
    .then((accounts) => {
      if (active && !accountEventReceived) listener(getPrimaryAccount(accounts));
    })
    .catch(() => undefined);

  return () => {
    active = false;
    provider.removeListener?.("accountsChanged", handleAccountsChanged);
  };
}

function getPrimaryAccount(accounts: unknown): Address | undefined {
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !isAddress(accounts[0])) {
    return undefined;
  }
  return getAddress(accounts[0]);
}

function getInjectedProvider(): InjectedProvider {
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
