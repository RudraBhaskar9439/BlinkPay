import {
  monadMainnet,
  usdcAddresses,
  wmonAddresses,
  zeroExAllowanceHolderAddresses,
} from "@blinkpay/chain";
import { decodeSignedInvoice } from "@blinkpay/core";
import { requestExactBuyQuote } from "@blinkpay/zerox";
import { NextResponse } from "next/server";
import {
  getAddress,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from "viem";

type QuoteRequestBody = {
  invoicePayload?: unknown;
  payer?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const invoicePayload = requireString(body.invoicePayload, "invoicePayload");
    const payer = requireRequestAddress(body.payer, "payer");
    const { invoice } = decodeInvoiceRequest(invoicePayload);
    const router = requireAddress(
      process.env.NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS,
      "NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS",
    );

    if (invoice.chainId !== BigInt(monadMainnet.id)) {
      throw new RequestError("Invoice is not for Monad mainnet");
    }
    if (invoice.settlementToken !== getAddress(usdcAddresses.mainnet)) {
      throw new RequestError("Invoice settlement token is not canonical Monad USDC");
    }

    const now = BigInt(Math.floor(Date.now() / 1_000));
    if (invoice.expiry <= now + 5n) throw new RequestError("Invoice expires too soon to quote safely");

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
