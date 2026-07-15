import {
  activeMonadChain,
  activeMonadNetwork,
  createMonadPublicClient,
} from "@blinkpay/chain";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();

  try {
    const client = createMonadPublicClient(activeMonadNetwork);
    const [chainId, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);

    if (chainId !== activeMonadChain.id) {
      throw new Error(`Expected chain ${activeMonadChain.id}, received ${chainId}`);
    }

    return NextResponse.json(
      {
        ok: true,
        chainId,
        blockNumber: blockNumber.toString(),
        latencyMs: Math.round(performance.now() - startedAt),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown RPC error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
