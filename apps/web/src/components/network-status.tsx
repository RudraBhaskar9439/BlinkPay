import { createMonadPublicClient, monadMainnet } from "@blinkpay/chain";
import Link from "next/link";

async function readNetworkStatus(): Promise<
  { ok: true; blockNumber: bigint } | { ok: false }
> {
  try {
    const client = createMonadPublicClient("mainnet");
    const [chainId, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);

    if (chainId !== monadMainnet.id) {
      throw new Error(`Unexpected chain ${chainId}`);
    }

    return { ok: true, blockNumber };
  } catch {
    return { ok: false };
  }
}

export async function NetworkStatus() {
  const status = await readNetworkStatus();

  if (!status.ok) {
    return (
      <Link className="networkStatus offline" href="/">
        <span className="statusDot" />
        RPC unavailable · retry
      </Link>
    );
  }

  return (
    <div className="networkStatus online" role="status">
      <span className="statusDot" />
      Monad block {Number(status.blockNumber).toLocaleString("en-US")}
    </div>
  );
}
