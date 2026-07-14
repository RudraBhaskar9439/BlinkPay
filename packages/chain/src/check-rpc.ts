import { createMonadPublicClient, monadMainnet } from "./index";

const startedAt = performance.now();
const client = createMonadPublicClient("mainnet");
const [chainId, blockNumber] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber(),
]);

if (chainId !== monadMainnet.id) {
  throw new Error(`Expected chain ${monadMainnet.id}, received ${chainId}`);
}

const latencyMs = Math.round(performance.now() - startedAt);
console.log(`Monad mainnet OK — chain ${chainId}, block ${blockNumber}, ${latencyMs} ms`);
