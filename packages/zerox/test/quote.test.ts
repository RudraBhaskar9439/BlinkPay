import { describe, expect, it, vi } from "vitest";
import { getAddress, type Address, type Hex } from "viem";
import {
  parseExactBuyQuote,
  requestExactBuyQuote,
  type ExactBuyRequest,
  type ZeroExConfig,
} from "../src/index";

const SELL_TOKEN = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as Address;
const BUY_TOKEN = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as Address;
const ROUTER = "0x1111111111111111111111111111111111111111" as Address;
const PAYER = "0x2222222222222222222222222222222222222222" as Address;
const ALLOWANCE_TARGET = "0x0000000000001fF3684f28c67538d4D072C22734" as Address;
const SWAP_TARGET = "0x3333333333333333333333333333333333333333" as Address;
const SELECTOR = "0x12345678" as Hex;

const request: ExactBuyRequest = {
  chainId: 143,
  sellToken: SELL_TOKEN,
  buyToken: BUY_TOKEN,
  buyAmount: 1_000_000n,
  taker: ROUTER,
  txOrigin: PAYER,
  recipient: ROUTER,
};

const config: ZeroExConfig = {
  apiKey: "test-key",
  allowanceTarget: ALLOWANCE_TARGET,
  swapTargets: [SWAP_TARGET],
  swapSelectors: [SELECTOR],
  quoteTtlSeconds: 30,
  now: () => 1_700_000_000_000,
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    liquidityAvailable: true,
    sellToken: SELL_TOKEN.toLowerCase(),
    buyToken: BUY_TOKEN.toLowerCase(),
    buyAmount: "1000000",
    maxSellAmount: "250000000000000000",
    estimatedNetSellAmount: "240000000000000000",
    allowanceTarget: ALLOWANCE_TARGET,
    blockNumber: "123456",
    transaction: {
      to: SWAP_TARGET,
      data: `${SELECTOR}${"00".repeat(32)}`,
      value: "0",
      gas: "450000",
    },
    ...overrides,
  };
}

describe("0x exact-buy quote validation", () => {
  it("accepts an allowlisted exact-output quote", () => {
    const quote = parseExactBuyQuote(payload(), request, config);

    expect(quote.sellToken).toBe(getAddress(SELL_TOKEN));
    expect(quote.buyAmount).toBe(1_000_000n);
    expect(quote.maxSellAmount).toBe(250_000_000_000_000_000n);
    expect(quote.expiresAt).toBe(1_700_000_030n);
  });

  it("rejects a changed exact output", () => {
    expect(() => parseExactBuyQuote(payload({ buyAmount: "999999" }), request, config))
      .toThrow("changed the exact invoice amount");
  });

  it("rejects an unapproved spender", () => {
    expect(() =>
      parseExactBuyQuote(
        payload({ allowanceTarget: "0x4444444444444444444444444444444444444444" }),
        request,
        config,
      ),
    ).toThrow("unapproved allowance target");
  });

  it("rejects an unapproved target or selector", () => {
    expect(() =>
      parseExactBuyQuote(
        payload({ transaction: { ...payload().transaction as object, to: PAYER } }),
        request,
        config,
      ),
    ).toThrow("unapproved swap target");

    expect(() =>
      parseExactBuyQuote(
        payload({
          transaction: {
            ...payload().transaction as object,
            data: `0x87654321${"00".repeat(32)}`,
          },
        }),
        request,
        config,
      ),
    ).toThrow("unapproved swap selector");
  });

  it("rejects unexpected native value", () => {
    expect(() =>
      parseExactBuyQuote(
        payload({ transaction: { ...payload().transaction as object, value: "1" } }),
        request,
        config,
      ),
    ).toThrow("unexpectedly requires native value");
  });

  it("rejects a quote without executable liquidity", () => {
    expect(() =>
      parseExactBuyQuote(payload({ liquidityAvailable: false }), request, config),
    ).toThrow("No executable WMON route is available");
  });

  it("sends the API key only in the server request header", async () => {
    const fetcher = vi.fn(async () => Response.json(payload()));
    const quote = await requestExactBuyQuote(request, { ...config, fetcher });

    expect(quote.buyAmount).toBe(request.buyAmount);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("chainId=143");
    expect(url).toContain("buyAmount=1000000");
    expect(url).not.toContain("test-key");
    expect(init.headers).toMatchObject({ "0x-api-key": "test-key", "0x-version": "v2" });
  });

  it("returns deterministic API errors without exposing credentials", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ reason: "INSUFFICIENT_ASSET_LIQUIDITY" }, { status: 400 }),
    );

    await expect(requestExactBuyQuote(request, { ...config, fetcher }))
      .rejects.toThrow("0x quote failed: INSUFFICIENT_ASSET_LIQUIDITY");
  });
});
