import {
  getAddress,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";

const ZEROX_QUOTE_URL = "https://api.0x.org/swap/allowance-holder/quote";

export type ExactBuyRequest = {
  chainId: number;
  sellToken: Address;
  buyToken: Address;
  buyAmount: bigint;
  taker: Address;
  txOrigin: Address;
  recipient: Address;
  slippageBps?: number;
};

export type ZeroExConfig = {
  apiKey: string;
  allowanceTarget: Address;
  swapTargets: readonly Address[];
  swapSelectors: readonly Hex[];
  quoteTtlSeconds?: number;
  fetcher?: typeof fetch;
  now?: () => number;
};

export type ExecutableSwapQuote = {
  sellToken: Address;
  buyToken: Address;
  buyAmount: bigint;
  maxSellAmount: bigint;
  estimatedSellAmount?: bigint;
  allowanceTarget: Address;
  swapTarget: Address;
  swapCallData: Hex;
  transactionValue: bigint;
  gas?: bigint;
  blockNumber?: bigint;
  expiresAt: bigint;
};

export async function requestExactBuyQuote(
  request: ExactBuyRequest,
  config: ZeroExConfig,
): Promise<ExecutableSwapQuote> {
  validateRequest(request);
  validateConfig(config);

  const parameters = new URLSearchParams({
    chainId: request.chainId.toString(),
    sellToken: request.sellToken,
    buyToken: request.buyToken,
    buyAmount: request.buyAmount.toString(),
    taker: request.taker,
    txOrigin: request.txOrigin,
    recipient: request.recipient,
    slippageBps: (request.slippageBps ?? 50).toString(),
  });

  const response = await (config.fetcher ?? fetch)(`${ZEROX_QUOTE_URL}?${parameters}`, {
    headers: {
      "0x-api-key": config.apiKey,
      "0x-version": "v2",
    },
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readApiError(payload, response.status));
  }

  return parseExactBuyQuote(payload, request, config);
}

export function parseExactBuyQuote(
  payload: unknown,
  request: ExactBuyRequest,
  config: ZeroExConfig,
): ExecutableSwapQuote {
  if (!isRecord(payload)) throw new Error("0x returned an invalid quote payload");
  if (payload.liquidityAvailable === false) throw new Error("No executable WMON route is available");
  if (!isRecord(payload.transaction)) throw new Error("0x quote has no executable transaction");

  const sellToken = requireAddress(payload.sellToken, "sellToken");
  const buyToken = requireAddress(payload.buyToken, "buyToken");
  const buyAmount = requirePositiveBigInt(payload.buyAmount, "buyAmount");
  const maxSellAmount = requirePositiveBigInt(payload.maxSellAmount, "maxSellAmount");
  const allowanceTarget = readAllowanceTarget(payload);
  const swapTarget = requireAddress(payload.transaction.to, "transaction.to");
  const swapCallData = requireCallData(payload.transaction.data);
  const transactionValue = requireUnsignedBigInt(payload.transaction.value ?? "0", "transaction.value");

  if (sellToken !== getAddress(request.sellToken)) throw new Error("0x changed the sell token");
  if (buyToken !== getAddress(request.buyToken)) throw new Error("0x changed the buy token");
  if (buyAmount !== request.buyAmount) throw new Error("0x changed the exact invoice amount");
  if (allowanceTarget !== getAddress(config.allowanceTarget)) {
    throw new Error("0x returned an unapproved allowance target");
  }
  if (!config.swapTargets.some((target) => getAddress(target) === swapTarget)) {
    throw new Error("0x returned an unapproved swap target");
  }

  const selector = swapCallData.slice(0, 10).toLowerCase();
  if (!config.swapSelectors.some((allowed) => allowed.toLowerCase() === selector)) {
    throw new Error("0x returned an unapproved swap selector");
  }
  if (transactionValue !== 0n) throw new Error("WMON quote unexpectedly requires native value");

  const now = BigInt(Math.floor((config.now ?? Date.now)() / 1_000));
  const ttl = BigInt(config.quoteTtlSeconds ?? 30);
  const estimated = payload.estimatedNetSellAmount ?? payload.estimatedSellAmount;

  return {
    sellToken,
    buyToken,
    buyAmount,
    maxSellAmount,
    estimatedSellAmount:
      estimated === undefined ? undefined : requirePositiveBigInt(estimated, "estimatedSellAmount"),
    allowanceTarget,
    swapTarget,
    swapCallData,
    transactionValue,
    gas:
      payload.transaction.gas === undefined
        ? undefined
        : requirePositiveBigInt(payload.transaction.gas, "transaction.gas"),
    blockNumber:
      payload.blockNumber === undefined
        ? undefined
        : requireUnsignedBigInt(payload.blockNumber, "blockNumber"),
    expiresAt: now + ttl,
  };
}

function validateRequest(request: ExactBuyRequest): void {
  if (!Number.isSafeInteger(request.chainId) || request.chainId <= 0) {
    throw new Error("chainId must be a positive integer");
  }
  if (request.buyAmount <= 0n) throw new Error("buyAmount must be positive");
  for (const [field, value] of Object.entries({
    sellToken: request.sellToken,
    buyToken: request.buyToken,
    taker: request.taker,
    txOrigin: request.txOrigin,
    recipient: request.recipient,
  })) {
    if (!isAddress(value, { strict: true })) throw new Error(`${field} must be a valid address`);
  }
  const slippageBps = request.slippageBps ?? 50;
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1_000) {
    throw new Error("slippageBps must be between 0 and 1000");
  }
}

function validateConfig(config: ZeroExConfig): void {
  if (!config.apiKey.trim()) throw new Error("0x API key is not configured");
  if (!isAddress(config.allowanceTarget, { strict: true })) {
    throw new Error("0x allowance target is invalid");
  }
  if (config.swapTargets.length === 0 || config.swapSelectors.length === 0) {
    throw new Error("0x swap allowlist is not configured");
  }
  if (config.quoteTtlSeconds !== undefined && config.quoteTtlSeconds <= 0) {
    throw new Error("quote TTL must be positive");
  }
}

function readAllowanceTarget(payload: Record<string, unknown>): Address {
  if (isRecord(payload.issues) && isRecord(payload.issues.allowance)) {
    return requireAddress(payload.issues.allowance.spender, "issues.allowance.spender");
  }
  return requireAddress(payload.allowanceTarget, "allowanceTarget");
}

function requireAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new Error(`0x ${field} is invalid`);
  }
  return getAddress(value);
}

function requireCallData(value: unknown): Hex {
  if (typeof value !== "string" || !isHex(value, { strict: true }) || value.length < 10) {
    throw new Error("0x transaction.data is invalid");
  }
  return value;
}

function requirePositiveBigInt(value: unknown, field: string): bigint {
  const parsed = requireUnsignedBigInt(value, field);
  if (parsed <= 0n) throw new Error(`0x ${field} must be positive`);
  return parsed;
}

function requireUnsignedBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(`0x ${field} must be an unsigned integer`);
  }
  return BigInt(value);
}

function readApiError(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const reason = payload.reason ?? payload.message;
    if (typeof reason === "string" && reason.trim()) return `0x quote failed: ${reason}`;
  }
  return `0x quote failed with HTTP ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
