import {
  activeMonadChain,
  activeMonadNetwork,
  activeUsdcAddress,
  activeWmonAddress,
  blinkPayTestnetDeployment,
  createMonadPublicClient,
  monadMainnet,
  wmonAddresses,
  zeroExAllowanceHolderAddresses,
} from "@blinkpay/chain";
import {
  blinkPayRouterAbi,
  blinkPayTestnetPoolAbi,
  decodeSignedInvoice,
} from "@blinkpay/core";
import { requestExactBuyQuote } from "@blinkpay/zerox";
import { NextResponse } from "next/server";
import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  isHex,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";

type QuoteRequestBody = {
  invoicePayload?: unknown;
  payer?: unknown;
};

const TESTNET_QUOTE_TTL_SECONDS = 180n;

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const invoicePayload = requireString(body.invoicePayload, "invoicePayload");
    const payer = requireRequestAddress(body.payer, "payer");
    const { invoice } = decodeInvoiceRequest(invoicePayload);
    const configuredRouter = process.env.NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS
      ?? (activeMonadNetwork === "testnet" ? blinkPayTestnetDeployment.router : undefined);
    const router = requireAddress(
      configuredRouter,
      "NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS",
    );

    if (invoice.chainId !== BigInt(activeMonadChain.id)) {
      throw new RequestError(`Invoice is not for ${activeMonadChain.name}`);
    }
    if (invoice.settlementToken !== getAddress(activeUsdcAddress)) {
      throw new RequestError("Invoice settlement token is not canonical Monad USDC");
    }

    const now = BigInt(Math.floor(Date.now() / 1_000));
    if (invoice.expiry <= now + 5n) throw new RequestError("Invoice expires too soon to quote safely");

    if (activeMonadNetwork === "testnet") {
      return NextResponse.json(await createTestnetQuote(invoice.amount, invoice.expiry, router));
    }

    const apiKey = process.env.ZEROX_API_KEY?.trim();
    if (!apiKey) throw new ConfigurationError("0x API key is not configured");

    const quote = await requestExactBuyQuote(
      {
        chainId: monadMainnet.id,
        sellToken: wmonAddresses.mainnet,
        buyToken: invoice.settlementToken,
        buyAmount: invoice.amount,
        taker: router,
        txOrigin: payer,
        recipient: router,
        slippageBps: 50,
      },
      {
        apiKey,
        allowanceTarget: zeroExAllowanceHolderAddresses.mainnet,
        swapTargets: [
          requireAddress(process.env.ZEROX_SWAP_TARGET, "ZEROX_SWAP_TARGET"),
        ],
        swapSelectors: requireSelectorList(
          process.env.ZEROX_SWAP_SELECTORS,
          "ZEROX_SWAP_SELECTORS",
        ),
        quoteTtlSeconds: 30,
      },
    );

    const expiresAt = quote.expiresAt < invoice.expiry ? quote.expiresAt : invoice.expiry;

    return NextResponse.json({
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      buyAmount: quote.buyAmount.toString(),
      maxSellAmount: quote.maxSellAmount.toString(),
      estimatedSellAmount: quote.estimatedSellAmount?.toString(),
      allowanceTarget: quote.allowanceTarget,
      swapTarget: quote.swapTarget,
      swapCallData: quote.swapCallData,
      gas: quote.gas?.toString(),
      blockNumber: quote.blockNumber?.toString(),
      expiresAt: expiresAt.toString(),
    });
  } catch (error) {
    const status = error instanceof RequestError
      ? 400
      : error instanceof ConfigurationError
        ? 503
        : 502;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}

async function createTestnetQuote(
  buyAmount: bigint,
  invoiceExpiry: bigint,
  router: Address,
) {
  const configuredPool = process.env.NEXT_PUBLIC_BLINKPAY_TESTNET_POOL_ADDRESS
    ?? blinkPayTestnetDeployment.pool;
  const pool = requireAddress(
    configuredPool,
    "NEXT_PUBLIC_BLINKPAY_TESTNET_POOL_ADDRESS",
  );
  const client = createMonadPublicClient("testnet");

  const swapSelector = toFunctionSelector(
    "swapExactOutput(uint256 maxSellAmount,uint256 amountOut,address recipient)",
  );
  const [
    quotedSellAmount,
    poolSellAsset,
    poolSettlementAsset,
    routerSellAsset,
    routerSettlementAsset,
    routerSwapTarget,
    routerAllowanceTarget,
    selectorAllowed,
    poolSellReserve,
    poolSettlementReserve,
  ] = await Promise.all([
    client.readContract({
      address: pool,
      abi: blinkPayTestnetPoolAbi,
      functionName: "quoteExactOutput",
      args: [buyAmount],
    }),
    client.readContract({ address: pool, abi: blinkPayTestnetPoolAbi, functionName: "sellAsset" }),
    client.readContract({
      address: pool,
      abi: blinkPayTestnetPoolAbi,
      functionName: "settlementAsset",
    }),
    client.readContract({ address: router, abi: blinkPayRouterAbi, functionName: "sellAsset" }),
    client.readContract({
      address: router,
      abi: blinkPayRouterAbi,
      functionName: "settlementAsset",
    }),
    client.readContract({ address: router, abi: blinkPayRouterAbi, functionName: "swapTarget" }),
    client.readContract({ address: router, abi: blinkPayRouterAbi, functionName: "allowanceTarget" }),
    client.readContract({
      address: router,
      abi: blinkPayRouterAbi,
      functionName: "allowedSwapSelectors",
      args: [swapSelector],
    }),
    client.readContract({
      address: getAddress(activeWmonAddress),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [pool],
    }),
    client.readContract({
      address: getAddress(activeUsdcAddress),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [pool],
    }),
  ]);

  const canonicalWmon = getAddress(activeWmonAddress);
  const canonicalUsdc = getAddress(activeUsdcAddress);
  if (getAddress(poolSellAsset) !== canonicalWmon || getAddress(routerSellAsset) !== canonicalWmon) {
    throw new ConfigurationError("Testnet pool or router is not configured for canonical WMON");
  }
  if (
    getAddress(poolSettlementAsset) !== canonicalUsdc
      || getAddress(routerSettlementAsset) !== canonicalUsdc
  ) {
    throw new ConfigurationError("Testnet pool or router is not configured for Circle USDC");
  }
  if (getAddress(routerSwapTarget) !== pool || getAddress(routerAllowanceTarget) !== pool) {
    throw new ConfigurationError("Testnet router is not paired with the configured pool");
  }
  if (!selectorAllowed) throw new ConfigurationError("Testnet pool swap selector is not allowlisted");

  const maxSellAmount = quotedSellAmount * 10_050n / 10_000n + 1n;
  const spotSellAmount = poolSettlementReserve === 0n
    ? 0n
    : poolSellReserve * buyAmount / poolSettlementReserve;
  const swapCostBps = spotSellAmount === 0n || quotedSellAmount <= spotSellAmount
    ? 0
    : Number((quotedSellAmount - spotSellAmount) * 10_000n / spotSellAmount);
  const now = BigInt(Math.floor(Date.now() / 1_000));
  const quoteExpiry = now + TESTNET_QUOTE_TTL_SECONDS;
  const expiresAt = quoteExpiry < invoiceExpiry ? quoteExpiry : invoiceExpiry;
  const swapCallData = encodeFunctionData({
    abi: blinkPayTestnetPoolAbi,
    functionName: "swapExactOutput",
    args: [maxSellAmount, buyAmount, router],
  });

  return {
    route: "blinkpay-testnet-pool",
    sellToken: canonicalWmon,
    buyToken: canonicalUsdc,
    buyAmount: buyAmount.toString(),
    maxSellAmount: maxSellAmount.toString(),
    estimatedSellAmount: quotedSellAmount.toString(),
    swapCostBps,
    poolSellReserve: poolSellReserve.toString(),
    poolSettlementReserve: poolSettlementReserve.toString(),
    allowanceTarget: pool,
    swapTarget: pool,
    swapCallData,
    expiresAt: expiresAt.toString(),
  };
}

async function readBody(request: Request): Promise<QuoteRequestBody> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new RequestError("Quote request must be a JSON object");
    }
    return value as QuoteRequestBody;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("Quote request contains invalid JSON");
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) throw new RequestError(`${field} is required`);
  return value;
}

function decodeInvoiceRequest(payload: string) {
  try {
    return decodeSignedInvoice(payload);
  } catch (error) {
    throw new RequestError(getErrorMessage(error));
  }
}

function requireAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new ConfigurationError(`${field} is not a valid address`);
  }
  return getAddress(value);
}

function requireRequestAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new RequestError(`${field} is not a valid address`);
  }
  return getAddress(value);
}

function requireSelectorList(value: string | undefined, field: string): Hex[] {
  if (!value?.trim()) throw new ConfigurationError(`${field} is not configured`);
  return value.split(",").map((entry) => {
    const selector = entry.trim();
    if (!isHex(selector, { strict: true }) || selector.length !== 10) {
      throw new ConfigurationError(`${field} contains an invalid selector`);
    }
    return selector;
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to create a swap quote";
}

class RequestError extends Error { }
class ConfigurationError extends Error { }
