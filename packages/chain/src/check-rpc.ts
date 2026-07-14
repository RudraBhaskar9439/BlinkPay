import { activeMonadChain, activeMonadNetwork, createMonadPublicClient } from "./index";

const startedAt = performance.now();
const client = createMonadPublicClient(activeMonadNetwork);
const [chainId, blockNumber] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber(),
]);

if (chainId !== activeMonadChain.id) {
  throw new Error(`Expected chain ${activeMonadChain.id}, received ${chainId}`);
}

const latencyMs = Math.round(performance.now() - startedAt);
console.log(`${activeMonadChain.name} OK — chain ${chainId}, block ${blockNumber}, ${latencyMs} ms`);
